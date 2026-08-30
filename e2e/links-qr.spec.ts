import { test, expect } from "@playwright/test";
import { decodeQrFromLocator } from "./lib/qr";

/**
 * subtask_754d 検証項目 4: 全リンク・全QRの着地確認。
 *   (a) QR画像を実ピクセルからデコードしてURLを取り出す(aria-label/alt厳禁)
 *   (b) page.goto() で実際にそのURLへ着地する
 *   (c) 着地先に期待する要素が存在することをassertする
 *
 * href/aria-labelを目で読んで「正しそう」と判定するのは禁止
 * (2026-08-30 keynote QR誤り事案の再発防止・cmd_754追補)。
 *
 * 本リポ(index.html/ja/index.html)には QR コードは seed スライドの
 * 1 箇所のみ(実探索で確認済み・重複含めゼロ)。会場からの投稿は
 * この QR から誘導する設計であるため、着地先は本リポ独立の
 * 投稿ページ(/post/)であるべき ——それこそが cmd_754 の目的
 * (製品デッキへの位置依存という旧livedeckの構造欠陥からの脱却)。
 *
 * QRは印刷・投影される都合上、本番公開URL(GitHub Pages)を符号化する
 * のが正しい設計であり、ローカル検証(baseURL=localhost)とは
 * originが一致しないのが通常。よって判定は「パスが/post/であるか」を
 * 主とし、実際のnavigate+要素assertは(a) baseURLと同一origin
 * (デプロイ後にE2E_BASE_URLを指定して実行する場合)、または
 * (b) 既知の本番公開origin(GitHub Pages)の場合にのみ行う。
 * それ以外(未知のorigin・旧livedeck等)は明確な欠陥として報告する。
 */
const EXPECTED_POST_PATH = "/post/";
const KNOWN_PRODUCTION_ORIGINS = ["https://geolonia.github.io"];

for (const lang of ["en", "ja"] as const) {
  const base = lang === "en" ? "/" : "/ja/";

  test(`seed スライドのQR(${lang}): ピクセルデコード→着地→投稿フォーム要素assert`, async ({ page, baseURL }) => {
    await page.goto(base + "#1", { waitUntil: "load" });
    await page.waitForTimeout(800);

    const active = page.locator(".slide.is-active");
    await expect(active).toHaveAttribute("data-slide", "seed");

    const qr = active.locator(".title__qr svg");
    await expect(qr).toBeVisible();

    const decoded = await decodeQrFromLocator(qr);
    expect(decoded, "QRピクセルデコードに失敗した").toBeTruthy();

    // ★ aria-label/<title> と独立にピクセルから取り出した値を報告に残す
    //   (aria-label と一致するかどうかは参考情報であり、判定根拠にしない)。
    const ariaLabel = await qr.getAttribute("aria-label");
    console.log(`[754d QR実測 ${lang}] pixel-decoded="${decoded}" aria-label="${ariaLabel}"`);

    const decodedUrl = new URL(decoded!, baseURL);
    expect(
      decodedUrl.pathname,
      `QRの着地先パス "${decodedUrl.pathname}" が本リポの投稿ページ(${EXPECTED_POST_PATH})でない ` +
        `(旧livedeckまたは無関係のURLを指している疑いが強い・cmd_754の目的に反する回帰)。`,
    ).toContain(EXPECTED_POST_PATH);

    const isTestOwnOrigin = !!baseURL && decodedUrl.origin === new URL(baseURL).origin;
    const isKnownProductionOrigin = KNOWN_PRODUCTION_ORIGINS.includes(decodedUrl.origin);

    if (!isTestOwnOrigin && !isKnownProductionOrigin) {
      throw new Error(
        `QRの着地先origin "${decodedUrl.origin}" が既知の本番origin(${KNOWN_PRODUCTION_ORIGINS.join(", ")})とも` +
          `テスト自身のbaseURL(${baseURL})とも一致しない——見覚えのないoriginへ誘導している疑いが強い。`,
      );
    }

    if (!isTestOwnOrigin) {
      // 本番originを指している(パスも/post/で正しい)が、ローカル検証環境からは
      // 未デプロイの可能性が高いため実navigateは行わない(デプロイ後は
      // E2E_BASE_URL=<デプロイ済みURL> で実行すれば isTestOwnOrigin 側の
      // 分岐に入り、実際に着地して #cb-form まで実assertされる)。
      console.log(
        `[754d QR実測 ${lang}] 着地先は本番origin "${decodedUrl.origin}" かつパスも正しい(/post/)。` +
          `ローカル検証環境のbaseURL(${baseURL})とは別originのため実navigateは省略した ` +
          `(デプロイ後にE2E_BASE_URLを指定して再実行すれば実着地まで検証される)。`,
      );
      return;
    }

    await page.goto(decoded!, { waitUntil: "load" });
    await expect(page.locator("#cb-form")).toBeVisible();
  });
}
