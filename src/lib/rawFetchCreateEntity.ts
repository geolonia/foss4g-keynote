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
 *
 * ★CodeRabbit指摘是正(PR#11): fetchは応答が返らない場合いつまでも
 * 解決も拒否もされないことがある。その間submitStateは"sending"に
 * 固定され、送信ボタンも無効のままユーザーが再試行できなくなる。
 * ゆえにタイムアウト用のAbortControllerを設け、期限超過時はfetch自体を
 * abortして既存の.catch()経路(submitState = "err")へ確実に落とす。
 */
export const SUBMIT_TIMEOUT_MS = 15000;

export async function createContributionEntityRawFetch(
  entity: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${contributionConnConfig.baseUrl}/ngsi-ld/v1/entities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/ld+json",
        "X-Api-Key": contributionConnConfig.key,
      },
      body: JSON.stringify(entity),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Create failed: timed out after ${SUBMIT_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // CodeRabbit指摘(PR#11): Response.json()がnullを返す(または非object値)場合、
    // body.detailの参照でTypeErrorになりうる。nullや非objectは{}へ正規化する。
    const parsed: unknown = await res.json().catch(() => null);
    const body: { detail?: string; description?: string } =
      parsed && typeof parsed === "object" ? parsed : {};
    throw new Error(
      `Create failed (${res.status}): ${body.detail ?? body.description ?? res.statusText}`,
    );
  }
}
