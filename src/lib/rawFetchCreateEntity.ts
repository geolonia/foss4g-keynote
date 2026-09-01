import { contributionConnConfig } from "./config";

/**
 * 会場投稿(Contribution)のcreateEntity専用・SDKバイパスの生fetch実装。
 *
 * 背景(将軍裁定 2026-09-01・ashigaru1実証): CONTRIBUTION_KEYは
 * dpopRequired=falseに緩和済みでサーバ側は`X-Api-Key`ヘッダ直付けの
 * POSTを受理するが、現行SDK(@geolonia/geonicdb-sdk@0.18.1)の
 * ensureToken()はapiKeyが設定されている限りdpopRequiredの値を見ず
 * 無条件で/auth/nonce起点のトークン交換(PoW)を強制する設計であり、
 * db.createEntity()を使う限りこの緩和が実際のデモ経路に効かない。
 * ゆえにこの1関数だけSDKの認証層を経由せず、実証済みのヘッダ構成
 * (X-Api-Key単体・Fiware-Serviceヘッダ不要)で直接POSTする。
 * WS購読・カウンタ取得は読み取り系につきdpopRequiredの対象か未確認
 * のため従来通りSDK経由のままとする。
 */
export async function createContributionEntityRawFetch(
  entity: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${contributionConnConfig.baseUrl}/ngsi-ld/v1/entities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/ld+json",
      "X-Api-Key": contributionConnConfig.key,
    },
    body: JSON.stringify(entity),
  });
  if (!res.ok) {
    const body: { detail?: string; description?: string } = await res
      .json()
      .catch(() => ({}));
    throw new Error(
      `Create failed (${res.status}): ${body.detail ?? body.description ?? res.statusText}`,
    );
  }
}
