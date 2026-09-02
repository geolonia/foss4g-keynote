/**
 * 世界を覆う実ジオコーディング(殿ご下命 2026-09-02 23:39: 47都道府県対応表
 * (resolveOriginCoords)方式は「海外の方のための検索を日本中心の表で作る」
 * 誤りとして撤回された)。
 *
 * Nominatim(OpenStreetMap)を使う——鍵不要・世界を覆う・CORS許可・FOSS4G
 * (Free and Open Source Software for Geospatial)の場に相応しい実例。
 * 利用規約(https://operations.osmfoundation.org/policies/nominatim/):
 * ①出典表記必須(呼び出し側=post/index.htmlで表示) ②最大1req/秒程度に自制
 * (このモジュールが直列化・間隔調整する) ③識別可能なUser-Agentが必須だが
 * ブラウザのfetchはUser-Agentを上書きできないため、ブラウザが自動送出する
 * Referer(このページのURL)で代替する(ブラウザ発のNominatim利用で広く
 * 行われている代替手段)。
 */

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
// Nominatim利用規約の目安「絶対に1req/秒を超えない」に対し、余裕を持たせる。
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let inFlight: AbortController | null = null;
// 直列化キュー: 2件の呼び出しが「待ち」に同時突入すると、両者とも同じ
// lastRequestAtを見て同時に起床し1req/秒を破ってしまう(CodeRabbit指摘)。
// 各呼び出しをこのキューへ鎖状につなぎ、前の呼び出しがlastRequestAtを
// 更新し終えてから次の呼び出しの待ち時間計算が始まるようにする。
let throttleQueue: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  const wait = throttleQueue.then(() => {
    const elapsed = Date.now() - lastRequestAt;
    return elapsed < MIN_INTERVAL_MS
      ? new Promise<void>((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
      : undefined;
  });
  throttleQueue = wait.then(() => {
    lastRequestAt = Date.now();
  });
  return throttleQueue;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * 自由入力の地名を座標へ解決する。世界のどの地名でも(対応表の47都道府県に
 * 限らず)解決を試みる。見つからない・失敗した場合は座標を捏造せず null を
 * 返す(呼び出し側は静かに何もしない・エラー表示を出さない契約)。
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  await throttle();

  // 直前の問い合わせがまだ飛んでいれば打ち切る(同一フィールドへの立て続けの
  // 確定操作が古い応答で新しい結果を上書きしないようにするため)。
  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const hit = rows[0];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: hit.display_name };
  } catch (err) {
    if ((err as { name?: string } | null)?.name !== "AbortError") {
      console.warn("[geocode] nominatim lookup failed", err);
    }
    return null;
  } finally {
    if (inFlight === controller) inFlight = null;
  }
}
