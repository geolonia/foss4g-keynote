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

/**
 * db.connect() を 'error' イベント駆動でリトライする。'connected' が一度でも
 * 観測されれば以降のリトライは行わない(その後の切断は SDK 自身の自動再接続
 * に委ねる — ここは「初回接続の429」だけを対象にした対症療法)。
 * 呼び出し側は返り値の cleanup() を（コンポーネント破棄等で）不要になった際に呼ぶ。
 */
export function connectWithRetry(db: GeonicDB, opts: ConnectRetryOptions = {}): () => void {
  // クライアントがシングルトン化された(client.ts参照)ため、contributionPost.ts
  // とcontributionMap.tsが同一dbに対してそれぞれconnectWithRetry()を呼びうる。
  // 既に接続済みならconnect()は即returnして'connected'を再emitしないため、
  // ここで観測せずリスナーを付けっぱなしにしない(不要なリスナー滞留の防止)。
  if (db.isConnected()) return () => {};

  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 1500;
  let attempt = 0;
  let settled = false;
  let timer = 0;

  function cleanup(): void {
    db.off("connected", onConnected);
    db.off("error", onError);
    if (timer) clearTimeout(timer);
  }

  function onConnected(): void {
    settled = true;
    cleanup();
  }

  function onError(): void {
    if (settled) return;
    attempt++;
    if (attempt >= maxAttempts) {
      settled = true;
      cleanup();
      opts.onGiveUp?.();
      return;
    }
    const delay = baseDelayMs * 2 ** (attempt - 1) + randomJitterMs(500);
    timer = setTimeout(() => {
      db.connect().catch(() => {
        /* connect()自体は429ではrejectしない(上記コメント参照)。
           万一reject経路があっても'error'側で拾えるためここは無視してよい。 */
      });
    }, delay);
  }

  db.on("connected", onConnected);
  db.on("error", onError);
  db.connect().catch(() => {});

  return cleanup;
}
