/* ===================================================================
   db.connect() の 429 沈黙 no-op 対策（cmd_754⑤ 5件目の欠陥・将軍裁定 2026-09-01）。

   ★根治ではなく対症療法である（将軍指摘 2026-09-01）: PUBLIC_RATE_LIMIT.auth
   の上限は固定のため、200名規模が一斉に押し寄せた場合はリトライしても
   捌ききれない可能性がある（将軍試算: 上限30/分なら200名で約7分かかる）。
   根治（認証往復自体を減らす設計）は別途進行中。ここでの狙いは
   「無限に沈黙して Loading… に固まる」最悪ケースだけを潰すことに限定する。

   ★★SDK側の既知の挙動（geonicdb.mjs 内 connect()）: 初回トークン取得
   （/auth/nonce への POST、429時に一切リトライしない）が失敗しても、
   connect() は Promise を reject せず 'error' イベントを emit するだけで
   静かに終わる。ゆえに `db.connect().catch(...)` は 429 では発火しない
   ——'error' イベントを監視してこちら側でリトライを駆動する必要がある。
   =================================================================== */
import type GeonicDB from "@geolonia/geonicdb-sdk";
import { randomJitterMs } from "./jitter";

export interface ConnectRetryOptions {
  /** 最大試行回数（初回含む）。既定4回。 */
  maxAttempts?: number;
  /** 指数バックオフの基準ms。既定1500ms(1.5s→3s→6s→...)。 */
  baseDelayMs?: number;
  /** 全試行を使い切っても 'connected' に至らなかった場合に一度だけ呼ばれる。 */
  onGiveUp?: () => void;
}

interface RetryState {
  attempt: number;
  settled: boolean;
  timer: number;
  giveUpCallbacks: Set<() => void>;
  /** 進行中のこのリトライループへ相乗りしている呼び出し元の数。
      onGiveUpの有無に関わらず全呼び出し元を数える(CodeRabbit指摘・PR#11:
      giveUpCallbacks.setはonGiveUpを渡さない呼び出し元を保持しないため、
      それをオーナー数の代わりに使うと早期teardownが起きる)。 */
  refCount: number;
  /** 生成元(最初の呼び出し)のみが持つteardown本体。相乗り側からの
      最終cleanupでも同じteardownを呼べるよう、状態に持たせておく。 */
  teardown: () => void;
}

/* client.tsのシングルトン化により、contributionPost.tsとcontributionMap.ts
   が同一dbに対してそれぞれconnectWithRetry()を呼びうる。dbごとに進行中の
   リトライ状態を1つだけ持たせ、後発の呼び出しは新たなリトライループを
   起こさず既存ループへ相乗りする(429対策の本来の目的=認証往復の削減が、
   2重のリトライループでかえって損なわれないようにするため)。 */
const inFlight = new WeakMap<GeonicDB, RetryState>();

/**
 * db.connect() を 'error' イベント駆動でリトライする。'connected' が一度でも
 * 観測されれば以降のリトライは行わない(その後の切断は SDK 自身の自動再接続
 * に委ねる — ここは「初回接続の429」だけを対象にした対症療法)。
 * 呼び出し側は返り値の cleanup() を（コンポーネント破棄等で）不要になった際に呼ぶ。
 */
export function connectWithRetry(db: GeonicDB, opts: ConnectRetryOptions = {}): () => void {
  if (db.isConnected()) return () => {};

  const existing = inFlight.get(db);
  if (existing) {
    // 既に進行中のリトライループがある(同一dbへの2件目以降の呼び出し)。
    // 新規のconnect()/リスナーを増やさず、give-up通知だけを相乗りさせる。
    existing.refCount++;
    if (opts.onGiveUp) existing.giveUpCallbacks.add(opts.onGiveUp);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (opts.onGiveUp) existing.giveUpCallbacks.delete(opts.onGiveUp);
      existing.refCount--;
      // 最後の所有者がcleanupした場合のみループ自体を止める(CodeRabbit指摘・PR#11)。
      if (existing.refCount === 0 && !existing.settled) existing.teardown();
    };
  }

  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 1500;
  const state: RetryState = {
    attempt: 0,
    settled: false,
    timer: 0,
    giveUpCallbacks: new Set(opts.onGiveUp ? [opts.onGiveUp] : []),
    refCount: 1,
    teardown: () => {},
  };
  inFlight.set(db, state);

  function teardown(): void {
    state.settled = true;
    db.off("connected", onConnected);
    db.off("error", onError);
    if (state.timer) clearTimeout(state.timer);
    if (inFlight.get(db) === state) inFlight.delete(db);
  }
  state.teardown = teardown;

  function onConnected(): void {
    teardown();
  }

  function onError(): void {
    if (state.settled) return;
    // 保留中の再試行タイマーがある間は追加のerrorを無視する(CodeRabbit指摘・PR#11)。
    // 無視しないと、最初のタイマーが実行される前にerrorが複数回発火した場合、
    // db.connect()の重複呼び出し・attemptの過剰前進が起きる。
    if (state.timer) return;
    state.attempt++;
    if (state.attempt >= maxAttempts) {
      const callbacks = [...state.giveUpCallbacks];
      teardown();
      callbacks.forEach((cb) => cb());
      return;
    }
    const delay = baseDelayMs * 2 ** (state.attempt - 1) + randomJitterMs(500);
    state.timer = setTimeout(() => {
      // db.connect()の呼び出し前にクリアする(呼び出しが同期的にerrorを
      // 再発火させても、上のガードに引っかからず正しく次の試行を積めるように)。
      state.timer = 0;
      db.connect().catch(() => {
        /* connect()自体は429ではrejectしない(上記コメント参照)。
           万一reject経路があっても'error'側で拾えるためここは無視してよい。 */
      });
    }, delay);
  }

  db.on("connected", onConnected);
  db.on("error", onError);
  db.connect().catch(() => {});

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (opts.onGiveUp) state.giveUpCallbacks.delete(opts.onGiveUp);
    state.refCount--;
    // 最後の所有者がcleanupした場合のみループ自体を止める(CodeRabbit指摘・PR#11:
    // onGiveUpを渡さない呼び出し元もrefCountで正しく数える)。
    if (state.refCount === 0 && !state.settled) teardown();
  };
}
