/**
 * トリガーが同時多発するタイミング(200名が一斉に/post/を開く等)で、
 * ネットワーク要求(特に GeonicDB SDK の auth token 交換)を一定範囲へ
 * ランダムに散らすための遅延値(ms)を返す。
 *
 * cmd_754 将軍裁定(2026-09-01): 投稿API障害の真因は、来場者ごとに1回走る
 * トークン引き換え(/auth/nonce → PoW → /oauth/token)が ControlPlaneHandler
 * Lambda へ一斉殺到すること。上限を上げるのは対症、呼び出し時刻を散らす
 * のが根治——という判断に基づく。
 */
export function randomJitterMs(maxMs: number): number {
  return Math.random() * maxMs;
}
