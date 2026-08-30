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
 * originが一致しないのが通常。よって判定は「パスが想定の投稿ページパスと
 * 完全一致するか」を主とし、実際のnavigate+要素assertは(a) baseURLと
 * 同一origin(デプロイ後にE2E_BASE_URLを指定して実行する場合)、または
 * (b) 既知の本番公開origin(GitHub Pages)の場合にも必ず行う——
 * ただし本番が未デプロイで実際に到達できない場合に限り、その旨を明示した
 * 上でPlaywright公式のtest.skip()で正直にSKIP扱いにする(黙って
 * PASS扱いにする沈黙no-opの再発防止・CodeRabbit指摘)。
 * それ以外(未知のorigin・旧livedeck等)は明確な欠陥として報告する。
 *
 * QRペイロードは印刷・投影される都合上、baseURLに依存せず単独で解決できる
 * 絶対URLでなければならない(相対パスのQRは印刷物単体では機能しない)。
 * よって `new URL(decoded)` はbaseURLへのフォールバックなしで行い、
 * 相対パスは即座に欠陥として扱う(CodeRabbit指摘)。
 */
const EXPECTED_POST_SEGMENT = "post/";
const KNOWN_PRODUCTION_ORIGINS = ["https://geolonia.github.io"];
// deploy.yml: `BASE_URL: /${{ github.event.repository.name }}/` — GitHub Pages が
// リポジトリ名をサブパスにする実際の値(このリポジトリでは固定文字列として既知)。
const KNOWN_PRODUCTION_BASE_PATH = "/foss4g-keynote/";

for (const lang of ["en", "ja"] as const) {
  const base = lang === "en" ? "./" : "./ja/";

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

    // ★絶対URL必須(baseURLへのフォールバックなし)。相対パスのQRは印刷物単体で
    // 機能しないため、それ自体を欠陥として扱う。
    let decodedUrl: URL;
    try {
      decodedUrl = new URL(decoded!);
    } catch {
      throw new Error(
        `QRペイロード "${decoded}" が絶対URLでない(相対パスは印刷・投影されるQRとして機能しない)。`,
      );
    }

    const isTestOwnOrigin = !!baseURL && decodedUrl.origin === new URL(baseURL).origin;
    const isKnownProductionOrigin = KNOWN_PRODUCTION_ORIGINS.includes(decodedUrl.origin);

    if (!isTestOwnOrigin && !isKnownProductionOrigin) {
      throw new Error(
        `QRの着地先origin "${decodedUrl.origin}" が既知の本番origin(${KNOWN_PRODUCTION_ORIGINS.join(", ")})とも` +
          `テスト自身のbaseURL(${baseURL})とも一致しない——見覚えのないoriginへ誘導している疑いが強い。`,
      );
    }

    // 想定パスはリポジトリ名サブパスの有無で変わるため、実際に使われている
    // baseURL(own origin時)または既知の本番BASE_URL(production origin時)から
    // 動的に導出する——ハードコードした "/post/" への `includes` 判定では
    // "/legacy/post/" のような誤誘導を通してしまうため、完全一致で検証する
    // (CodeRabbit指摘)。
    const expectedPostPath = isTestOwnOrigin
      ? new URL(EXPECTED_POST_SEGMENT, baseURL).pathname
      : KNOWN_PRODUCTION_BASE_PATH + EXPECTED_POST_SEGMENT;

    expect(
      decodedUrl.pathname,
      `QRの着地先パス "${decodedUrl.pathname}" が想定の投稿ページパス "${expectedPostPath}" と一致しない ` +
        `(旧livedeckまたは無関係のURLを指している疑いが強い・cmd_754の目的に反する回帰)。`,
    ).toBe(expectedPostPath);

    if (!isTestOwnOrigin) {
      // 本番originかつパスも正しいが、テスト自身のbaseURL(ローカル/未デプロイ環境)
      // とはoriginが異なる。実際にnavigateして#cb-formの存在までassertする
      // (CodeRabbit指摘: originが違うというだけで検証を省略してはならない)。
      // ただし本番へ実際にデプロイが完了していない場合は、コード上の欠陥と
      // 区別が付かない誤検知になるため、navigate失敗または非2xxのみ
      // test.skip()で正直にSKIP扱いにする(黙ってPASSにはしない)。
      let response: Awaited<ReturnType<typeof page.goto>> = null;
      try {
        response = await page.goto(decodedUrl.toString(), { waitUntil: "load", timeout: 15_000 });
      } catch (err) {
        test.skip(true, `本番origin "${decodedUrl.origin}" へのnavigateが失敗した(未デプロイの疑い): ${err}`);
        return;
      }
      if (!response || response.status() >= 400) {
        test.skip(
          true,
          `本番origin "${decodedUrl.origin}" は現時点で ${decodedUrl.pathname} を提供していない` +
            `(status=${response?.status()})。デプロイ後にE2E_BASE_URLを指定して再実行せよ。`,
        );
        return;
      }
      await expect(page.locator("#cb-form")).toBeVisible();
      return;
    }

    await page.goto(decodedUrl.toString(), { waitUntil: "load" });
    await expect(page.locator("#cb-form")).toBeVisible();
  });
}
