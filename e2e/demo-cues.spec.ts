import { test, expect } from "@playwright/test";

/**
 * subtask_754d 検証項目 5: DEMO CUEの実行(沈黙no-op対策)。
 *
 * ★root cause(殿ご指摘2026-08-30): contributionMap.tsは #cb-map が無ければ
 * エラーも出さず静かにno-opする設計。目視・「エラー無し」では沈黙no-opを
 * 見抜けない。assertするしかない。
 *
 * ★TODO(754d-integration): 実デッキ着地後、CUEを踏む実操作(クリック/タブ切替)
 * を data-slide 実値・実セレクタで埋めて skip を外す。
 */
test.describe("DEMO CUE 実行 (沈黙no-op検出)", () => {
  test.skip(!process.env.E2E_754D_DECK_READY, "index.html scaffold + contribution.ts DOM着地待ち");

  test("CUE②: 会場地図タブでミニマップが実際に描画される", async ({ page }) => {
    await page.goto("/#/"); // TODO: 実スライドindexへ
    // contribution.ts の initTabs() が .slide--cb 内 .fb-tab をクリックで切り替える想定。
    await page.locator(".slide--cb .fb-tab", { hasText: /地図|map/i }).click();

    const mapContainer = page.locator("#cb-map");
    await expect(mapContainer).toBeVisible();
    await expect(mapContainer).not.toHaveAttribute("hidden", "");
    // 沈黙no-op対策の核心: #cb-map の存在だけでなく、maplibre/geoloniaが実際に
    // canvasを描画したことまでassertする(存在確認だけでは前回の欠陥を再現する)。
    await expect(mapContainer.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("CUE④: 全画面地図に実際に切り替わる", async ({ page }) => {
    await page.goto("/#/"); // TODO: 実スライドindexへ
    await page.locator('[data-action="fullscreen-map"]').click(); // TODO: 実セレクタへ
    await expect(page.locator(".map-fullscreen canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("投稿ページ「地図を開く」操作の後に地図が本当に現れる", async ({ page }) => {
    await page.goto("/talk/"); // TODO(754d-integration): ashigaru2の実パスへ
    await page.getByRole("button", { name: /地図を開く|open map/i }).click();
    const mapContainer = page.locator("#cb-map");
    await expect(mapContainer).toBeVisible();
    await expect(mapContainer.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });
});
