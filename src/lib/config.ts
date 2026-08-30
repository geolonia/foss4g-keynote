/**
 * 会場投稿（Contribution）専用の接続設定。
 *
 * Contribution は ENTERPRISE 契約・川上さん作成テナント `foss4g_2026`
 * （将軍裁定 2026-08-29・旧 `foss4g_hiroshima_2026` から切替）へ書き込む
 * 専用の integration key を使う（Secrets Manager
 * `geonicdb/foss4g-2026/contribution-key`）。
 */
export interface ContributionConnConfig {
  baseUrl: string;
  tenant: string;
  key: string;
}

export const contributionConnConfig: ContributionConnConfig = {
  baseUrl: "https://geonicdb.geolonia.com",
  tenant: "foss4g_2026",
  key: import.meta.env.VITE_GEONICDB_CONTRIBUTION_KEY ?? "",
};
