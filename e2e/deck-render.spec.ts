import { test, expect } from "@playwright/test";

/**
 * subtask_754d 検証項目 7: console/networkエラー捕捉。
 *
 * svg数・図版スライド数等の視覚定量計測は e2e/keynote-visual.spec.ts に
 * 統合済み(実スライドslug・ArrowRightナビゲーションを既に正しく実装している
 * ためここでは重複させない)。本specはデッキ全体を一周する間の
 * console error / failed request の捕捉に専念する。
 *
 * ★沈黙no-op自体はエラーを出さないため、これだけでは検出できない
 * (検出はCUE系specでcanvas等を直接assertする)。ただし周辺の失敗
 * (アセット404・未捕捉例外等)はここで拾える。
 */
const SLIDE_COUNT = 16;

for (const lang of ["en", "ja"] as const) {
  const base = lang === "en" ? "/" : "/ja/";

  test(`デッキ一周(${lang})でconsole error・failed requestが無い`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      // net::ERR_ABORTED はMapLibre GLがコンテナresize/mode切替のたびに実行中の
      // タイル取得を意図的にキャンセルする際の正常系(実測で確認: #inset-mapが
      // hidden→inset→fullとモード遷移する本デッキの16スライド一周中、
      // mobile-iphoneプロジェクト(高deviceScaleFactor)でのみ再現し、実データの
      // 欠落やUIの破綻は伴わない)。tileserver.geolonia.com宛のタイル要求に限って
      // 除外し、それ以外(自前JS/API等)のERR_ABORTEDは引き続き失敗として扱う。
      if (req.failure()?.errorText === "net::ERR_ABORTED" && req.url().includes("tileserver.geolonia.com")) return;
      failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(base + "#1", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    for (let n = 1; n < SLIDE_COUNT; n++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1100); // keynote-visual.spec.tsと同じ遷移間隔(実運転相当)
    }

    // ローカル検証環境はAPIキー未設定のため GeonicDB 認証エラー(console.warn)が
    // 出る想定内の雑音。console.error のみを判定対象にしているため影響しない。
    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(failedRequests, `failed requests: ${failedRequests.join(" | ")}`).toEqual([]);
  });
}

test("投稿ページ(/post/)読込中にconsole error・failed requestが無い", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`);
  });

  await page.goto("/post/", { waitUntil: "load" });
  await expect(page.locator("#cb-form")).toBeVisible();
  await page.waitForTimeout(1000);

  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(failedRequests, `failed requests: ${failedRequests.join(" | ")}`).toEqual([]);
});
