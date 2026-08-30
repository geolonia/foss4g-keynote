import { test, expect } from "@playwright/test";

/**
 * subtask_754b: 独立投稿ページ /post/ の実ブラウザ検証。
 *
 * 2026-08-30 殿ご指摘の再発防止が本スペックの主目的:
 * 「地図を開くと言っていたが出てない」の真因は #cb-map という“器”が
 * どの index.html にも存在しなかったこと（contributionMap.ts は器が
 * 無ければ黙って no-op する設計）。ゆえに本スペックは
 *   ①器（#cb-map）がDOMに存在する
 *   ②「開く」操作の後、実際に地図（canvas）が描画される
 * の両方を個別にassertし、「器だけあって描画されない」を再発させない。
 */

test.describe("独立投稿ページ /post/", () => {
  test("デッキ本体に依存せず単独で開ける・フォーム要素が揃っている", async ({ page }) => {
    await page.goto("/post/");
    await expect(page).toHaveTitle(/会場投稿 \/ Venue Contribution/);

    // デッキ本体固有の要素が無いこと(独立ページであることの確認)。
    await expect(page.locator(".slide")).toHaveCount(0);
    await expect(page.locator("#hint")).toHaveCount(0);

    // フォーム要素が揃っている。
    await expect(page.locator("#cb-form")).toBeVisible();
    await expect(page.locator("#cb-origin")).toBeVisible();
    await expect(page.locator("#cb-specialty")).toBeVisible();
    await expect(page.locator("#cb-hiddenSpot")).toBeVisible();
    await expect(page.locator("#cb-submit")).toBeVisible();
  });

  test("バリデーション: 必須項目が空だと送信できずエラーが表示される", async ({ page }) => {
    await page.goto("/post/");
    await page.click("#cb-submit");
    await expect(page.locator("#cb-err-origin")).toHaveText(/出身地を入力してください/);
    await expect(page.locator("#cb-err-specialty")).toHaveText(/名物を入力してください/);
  });

  test("地図の器はページ読込直後からDOMに存在し、初期状態は非表示", async ({ page }) => {
    await page.goto("/post/");
    const map = page.locator("#cb-map");
    // 器そのものは存在する(沈黙no-opの再発防止・器を後付けしない)。
    await expect(map).toHaveCount(1);
    await expect(map).toBeHidden();
  });

  test("「地図を開く」操作で実際に地図(canvas)が描画される", async ({ page }) => {
    await page.goto("/post/");
    const map = page.locator("#cb-map");
    await expect(map).toBeHidden();

    await page.click("#cb-map-toggle");
    await expect(map).toBeVisible();

    // 器が見えるだけでなく、実際に MapLibre(Geolonia Maps) の canvas が
    // マウントされ描画されていることをassertする(器だけの沈黙no-op再発防止)。
    const canvas = map.locator("canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  });

  // Contribution integration key の allowedOrigins は http://localhost:8745 を含まない
  // (2026-08-30 実測: https://geolonia.github.io は許可済み・404ではなく
  // "Origin not allowed for this API key" で確認)。ローカル dev server からの
  // 実通信は構造的に不可能なため、デプロイ済み環境(E2E_BASE_URL)に対してのみ実行する。
  test("実投稿→カウンタと地図の両方に反映される(実バックエンド・E2Eタグ付き)", async ({ page, baseURL }) => {
    const isLocal = !baseURL || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);
    test.skip(
      isLocal,
      "localhost はContribution keyのallowedOriginsに含まれず実通信不可" +
        "(本番オリジン https://geolonia.github.io は許可済み・2026-08-30実測)。" +
        "E2E_BASE_URL=<デプロイ済みURL> で実行せよ。",
    );
    await page.goto("/post/");

    const countBefore = await page.locator("#cb-count").textContent();

    // 会場の生データと混同されぬよう明示的にE2Eタグを付ける
    // (家老指示の既存運用: subtask_751系のテスト投稿と同じ命名規則)。
    const origin = "E2E-テスト県";
    const specialty = "E2E-automated-test（自動テスト・削除予定）";

    await page.fill("#cb-origin", origin);
    await page.fill("#cb-specialty", specialty);
    await page.click("#cb-submit");

    await expect(page.locator("#cb-submit")).toHaveText(/投稿しました/, { timeout: 15_000 });

    // カウンタが増える(WS/初期GETいずれかで反映)。
    await expect
      .poll(async () => page.locator("#cb-count").textContent(), { timeout: 15_000 })
      .not.toBe(countBefore);

    // 地図側にも反映される(開いてWS購読→自分の投稿が地図のステータス行に出る)。
    await page.click("#cb-map-toggle");
    const status = page.locator("#cb-map .fb-chart__total");
    await expect(status).toContainText(/地図に表示中/, { timeout: 15_000 });
  });
});
