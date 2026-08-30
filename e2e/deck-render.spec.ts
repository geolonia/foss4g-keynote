import { test, expect } from "@playwright/test";

/**
 * subtask_754d 検証項目 1・2・7:
 *   1. 全ページ(デッキ全スライド+投稿ページ)を実際にPlaywrightで開く(curl/grep不可)
 *   2. レンダリング後DOMでsvg数・図版スライド数・文字のみスライド数を実測する
 *   7. console/network エラーを捕捉する
 *
 * ★TODO(754d-integration): ashigaru3(754a index.html scaffold)着地後、
 * ".slide" のセレクタ・想定スライド数を実物と突き合わせて skip を外すこと。
 * 現時点(2026-08-30時点)ではリポジトリに index.html が存在しないため
 * 実行不能ゆえ意図的に skip している(将軍指示: 骨組みは先に書く/統合待ちは待機)。
 */
test.describe("deck render + visual metrics (実測)", () => {
  test.skip(
    !process.env.E2E_754D_DECK_READY,
    "ashigaru3の index.html scaffold + ashigaru6のスライド着地待ち(E2E_754D_DECK_READY=1で有効化)",
  );

  test("全スライドが描画され、svg/図版/文字のみの実数が取得できる", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`${msg.text()} (${page.url()})`);
    });
    page.on("requestfailed", (req) => failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`));

    await page.goto("/");
    await expect(page.locator(".slide").first()).toBeVisible();

    const slideCount = await page.locator(".slide").count();
    expect(slideCount).toBeGreaterThan(0);

    // ソースHTMLの数ではなく、レンダリング後DOM(page.locator)から実測する。
    const svgCount = await page.locator("svg").count();
    const slidesWithSvg = await page.locator(".slide:has(svg)").count();
    const textOnlySlides = slideCount - slidesWithSvg;

    console.log(
      `[754d実測] slides=${slideCount} svgTotal=${svgCount} slidesWithSvg=${slidesWithSvg} textOnlySlides=${textOnlySlides}`,
    );

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(failedRequests, `failed requests: ${failedRequests.join(" | ")}`).toEqual([]);
  });

  test("投稿ページ(/talk/ 等)が描画される", async ({ page }) => {
    // TODO(754d-integration): ashigaru2完成後、実パスへ差し替える。
    await page.goto("/talk/");
    await expect(page.locator("#cb-form")).toBeVisible();
  });
});
