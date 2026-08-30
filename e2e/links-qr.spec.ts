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
 */
const EXPECTED_POST_PATH = "/post/";

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
    console.log(
      `[754d QR実測 ${lang}] pixel-decoded="${decoded}" aria-label="${ariaLabel}"`,
    );

    // 本リポ配下の相対パスへ誘導しているか(絶対URLでも自リポのoriginなら許容)。
    const decodedUrl = new URL(decoded!, baseURL);
    const isSameOriginPost =
      baseURL && decodedUrl.origin === new URL(baseURL).origin && decodedUrl.pathname.includes(EXPECTED_POST_PATH);

    if (!isSameOriginPost) {
      // ★意図的に「あるべき状態」をassertする(現状は既知の欠陥として落ちてよい)。
      // 実際に着地して要素の有無まで確認し、可視化された事実を証拠として残す。
      await page.goto(decoded!, { waitUntil: "load" }).catch((e) => {
        throw new Error(
          `QRの着地先 "${decoded}" へ navigate できなかった: ${e}. ` +
            `期待する着地先は本リポの ${EXPECTED_POST_PATH} だが、実際のQRは別サイトを指している疑いが強い。`,
        );
      });
      const hasPostForm = await page.locator("#cb-form").count();
      expect(
        hasPostForm,
        `QRの着地先 "${decoded}" に本リポの投稿フォーム(#cb-form)が存在しない。` +
          `期待する着地先は自リポの ${EXPECTED_POST_PATH} であり、QRの符号化先が` +
          `古いlivedeckまたは無関係のURLを指したままになっている疑いが強い ` +
          `(cmd_754の目的=製品デッキ位置依存からの脱却に反する重大な回帰)。`,
      ).toBeGreaterThan(0);
      return;
    }

    await page.goto(decoded!, { waitUntil: "load" });
    await expect(page.locator("#cb-form")).toBeVisible();
  });
}
