import GeonicDB from "@geolonia/geonicdb-sdk";
import { contributionConnConfig } from "./config";

/**
 * 会場投稿(Contribution)専用の GeonicDB SDK クライアントを生成する。
 *
 * 他デモとは別に、ENTERPRISE契約のテナント `foss4g_2026`
 * （将軍裁定 2026-08-29・旧 `foss4g_hiroshima_2026` から切替）向けの
 * integration key で接続する(`createClient()` のデッキ共通キーとは別物・混同禁物)。
 */
export function createContributionClient(): GeonicDB {
  return new GeonicDB({
    apiKey: contributionConnConfig.key,
    tenant: contributionConnConfig.tenant,
    baseUrl: contributionConnConfig.baseUrl,
  });
}
