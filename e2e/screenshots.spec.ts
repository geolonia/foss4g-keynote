import { test, expect } from "@playwright/test";

/**
 * subtask_754d 検証項目 3: 全スライドのスクリーンショットを1枚ずつ、
 * 投影解像度(1920x1080)とモバイルビューポートの両方で撮る。
 *
 * playwright.config.ts の projects で "projector-1920x1080" / "mobile-iphone"
 * の2プロジェクトを定義済み — `npx playwright test screenshots.spec.ts` は
 * 両方のprojectで自動的に実行される(--project指定不要)。
 *
 * ★TODO(754d-integration): index.html着地後にskipを外す。
 */
test.describe("全スライド スクリーンショット (投影解像度 + モバイル)", () => {
  test.skip(!process.env.E2E_754D_DECK_READY, "index.html scaffold着地待ち");

  test("全スライドを1枚ずつ撮影する", async ({ page }, testInfo) => {
    await page.goto("/");
    const slides = page.locator(".slide");
    const n = await slides.count();
    expect(n).toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      // デッキのナビゲーション作法(slides.ts)に合わせてhashで直接ジャンプする。
      await page.evaluate((idx) => {
        location.hash = "#" + (idx + 1);
      }, i);
      await expect(slides.nth(i)).toHaveClass(/is-active/);
      const screenshotPath = testInfo.outputPath(`slide-${String(i + 1).padStart(2, "0")}.png`);
      await slides.nth(i).screenshot({ path: screenshotPath });
    }
  });
});
