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
    if (opts.onGiveUp) existing.giveUpCallbacks.add(opts.onGiveUp);
    return () => {
      if (opts.onGiveUp) existing.giveUpCallbacks.delete(opts.onGiveUp);
    };
  }

  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 1500;
  const state: RetryState = {
    attempt: 0,
    settled: false,
    timer: 0,
    giveUpCallbacks: new Set(opts.onGiveUp ? [opts.onGiveUp] : []),
  };
  inFlight.set(db, state);

  function teardown(): void {
    state.settled = true;
    db.off("connected", onConnected);
    db.off("error", onError);
    if (state.timer) clearTimeout(state.timer);
    if (inFlight.get(db) === state) inFlight.delete(db);
  }

  function onConnected(): void {
    teardown();
  }

  function onError(): void {
    if (state.settled) return;
    state.attempt++;
    if (state.attempt >= maxAttempts) {
      const callbacks = [...state.giveUpCallbacks];
      teardown();
      callbacks.forEach((cb) => cb());
      return;
    }
    const delay = baseDelayMs * 2 ** (state.attempt - 1) + randomJitterMs(500);
    state.timer = setTimeout(() => {
      db.connect().catch(() => {
        /* connect()自体は429ではrejectしない(上記コメント参照)。
           万一reject経路があっても'error'側で拾えるためここは無視してよい。 */
      });
    }, delay);
  }

  db.on("connected", onConnected);
  db.on("error", onError);
  db.connect().catch(() => {});

  return () => {
    if (opts.onGiveUp) state.giveUpCallbacks.delete(opts.onGiveUp);
    // 呼び出し元が単独オーナーの場合のみ、明示cleanup()でループ自体も止める。
    if (state.giveUpCallbacks.size === 0) teardown();
  };
}
