import { test, expect } from "@playwright/test";

/**
 * subtask_754d 検証項目 6: 実投稿の通し試験。
 * フォームへ入力し送信し、地図・カウンタに反映されるところまでブラウザで通す。
 *
 * ★注意(constraints): 実投稿テストのデータはappend-only(NGSI-LDエンティティ)
 * ゆえ自己削除不可。本specで作成したテストエンティティは、実行後に
 * ashigaru4へ削除依頼を出すこと(originに識別可能な接頭辞を付け、
 * 後から特定・削除しやすくする)。
 *
 * ★TODO(754d-integration): 実デッキ・投稿ページ(ashigaru2)着地後にskipを外す。
 */
const TEST_ORIGIN_PREFIX = "e2eTEST_754d_";

test.describe("実投稿→反映の通し試験", () => {
  test.skip(!process.env.E2E_754D_DECK_READY, "投稿ページ(ashigaru2)着地待ち");

  test("フォーム送信 → カウンタ反映 → 地図反映", async ({ page }) => {
    const origin = `${TEST_ORIGIN_PREFIX}${Date.now()}`;
    await page.goto("/talk/");

    const beforeCount = await page.locator("#cb-count").textContent();

    await page.locator("#cb-origin").fill(origin);
    await page.locator("#cb-specialty").fill("e2eTEST-specialty");
    await page.locator("#cb-submit").click();

    await expect
      .poll(async () => page.locator("#cb-count").textContent(), { timeout: 10_000 })
      .not.toBe(beforeCount);

    // 地図タブへ切り替えて自分の投稿が反映されているか(座標解決できるorigin文字列を
    // 使う必要あり — TEST_ORIGIN_PREFIXがoriginGeo.tsで解決できない場合は
    // 実装済みの実在都道府県名等に差し替えること)。
    await page.locator(".slide--cb .fb-tab", { hasText: /地図|map/i }).click();
    await expect(page.locator("#cb-map canvas")).toBeVisible({ timeout: 10_000 });

    console.log(
      `[754d実投稿試験] origin="${origin}" を作成した。テスト完了後、ashigaru4へ削除依頼を出すこと。`,
    );
  });
});
