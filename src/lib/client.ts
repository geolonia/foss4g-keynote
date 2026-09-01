import GeonicDB from "@geolonia/geonicdb-sdk";
import { contributionConnConfig } from "./config";

let instance: GeonicDB | null = null;

/**
 * 会場投稿(Contribution)専用の GeonicDB SDK クライアントを生成する。
 *
 * 他デモとは別に、ENTERPRISE契約のテナント `foss4g_2026`
 * （将軍裁定 2026-08-29・旧 `foss4g_hiroshima_2026` から切替）向けの
 * integration key で接続する(`createClient()` のデッキ共通キーとは別物・混同禁物)。
 *
 * ★シングルトン(将軍裁定 2026-09-01・ashigaru3発見): contributionPost.ts
 * (カウンタ/投稿)と contributionMap.ts(地図)が別々に `new GeonicDB()` すると、
 * 同一訪問者だけで認証トークン交換(/auth/nonce)が2重に走り、
 * PUBLIC_RATE_LIMIT.auth バケットを不要に2重消費する。1訪問者につき
 * 1インスタンスに統一し、以降の呼び出しは同一インスタンスを返す。
 */
export function createContributionClient(): GeonicDB {
  if (!instance) {
    instance = new GeonicDB({
      apiKey: contributionConnConfig.key,
      tenant: contributionConnConfig.tenant,
      baseUrl: contributionConnConfig.baseUrl,
    });
  }
  return instance;
}
