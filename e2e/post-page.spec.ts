import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    __contributionDb?: { deleteEntity(id: string): Promise<unknown> };
  }
}

/** "地図に表示中: N 件（+仕込み M 件）..." から実投稿件数Nを取り出す。 */
function parseRealCount(text: string | null): number {
  const m = /地図に表示中:\s*(\d+)/.exec(text ?? "");
  return m ? Number(m[1]) : NaN;
}

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
  test("デッキ本体に依存せず単独で開ける・フォーム要素が揃っている(既定=英語)", async ({ page }) => {
    await page.goto("./post/");
    // 2026-08-30 23:24 殿ご指摘: FOSS4G Globalは英語講演ゆえUIは英語を既定とする。
    await expect(page).toHaveTitle(/Venue Contribution — FOSS4G Hiroshima 2026/);
    await expect(page.locator("h1")).toHaveText(/Your voice becomes data on the map/);
    await expect(page.locator("#cb-submit")).toHaveText("▶ Submit");

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

  test("バリデーション: 必須項目が空だと送信できずエラーが表示される(既定=英語)", async ({ page }) => {
    await page.goto("./post/");
    await page.click("#cb-submit");
    await expect(page.locator("#cb-err-origin")).toHaveText(/Please enter where you're from/);
    await expect(page.locator("#cb-err-specialty")).toHaveText(/Please enter a local specialty/);
  });

  test("言語切替: 既定は英語・トグルで日本語に切り替わる", async ({ page }) => {
    await page.goto("./post/");
    await expect(page.locator("h1")).toHaveText(/Your voice becomes data on the map/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.click("#cb-lang-toggle");
    await expect(page.locator("h1")).toHaveText(/あなたの一言が地図に載る/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#cb-submit")).toHaveText("▶ 投稿する");

    // 動的レンダリングのエラーメッセージも切り替わる。
    await page.click("#cb-submit");
    await expect(page.locator("#cb-err-origin")).toHaveText(/出身地を入力してください/);

    // 元に戻せる。
    await page.click("#cb-lang-toggle");
    await expect(page.locator("h1")).toHaveText(/Your voice becomes data on the map/);
    await expect(page.locator("#cb-err-origin")).toHaveText(/Please enter where you're from/);
  });

  test("言語切替: 地図内部(タイトル・凡例・状態文言)も現在の言語で描画される(CodeRabbit指摘対応)", async ({
    page,
  }) => {
    await page.goto("./post/");
    await page.click("#cb-map-toggle");
    const title = page.locator("#cb-map .fb-chart__title");
    await expect(title).toContainText("Venue Map");
    const legend = page.locator("#cb-map .fb-chart__legend");
    await expect(legend).toContainText("Venue submissions");

    await page.click("#cb-lang-toggle");
    await expect(title).toContainText("会場地図");
    await expect(legend).toContainText("会場の投稿");
  });

  test("言語切替: 送信中/失敗状態でも切替後の言語で正しく再描画される(CodeRabbit指摘対応)", async ({
    page,
  }) => {
    await page.goto("./post/");
    // localhostはContribution keyのallowedOriginsに含まれず実通信が拒否される
    // (既知の構造的制約)ため、有効な入力を送信すると確実に失敗状態(is-err)に
    // 到達する — これを利用して「送信中/失敗の文言が言語トグル後も正しいか」を検証する。
    await page.fill("#cb-origin", "France");
    await page.fill("#cb-specialty", "Fromage");
    await page.click("#cb-submit");
    await expect(page.locator("#cb-submit")).toHaveText(/Failed — please retry/, { timeout: 15_000 });

    await page.click("#cb-lang-toggle");
    await expect(page.locator("#cb-submit")).toHaveText(/投稿に失敗/);
  });

  test("出身地欄は日本限定ではない: datalistに国名が含まれ、国名を自由入力して検証を通過できる", async ({
    page,
  }) => {
    await page.goto("./post/");

    // 2026-08-30 23:28 gunshi指摘の真因是正確認: datalistが47都道府県のみだと
    // 「タップ=日本限定select」と誤認される。国名を含む混在リストになっているか。
    const options = await page.locator("#cb-origin-list option").evaluateAll((els) =>
      els.map((el) => (el as HTMLOptionElement).value),
    );
    expect(options).toContain("France");
    expect(options).toContain("Taiwan");
    expect(options.some((v) => v.includes("Japan"))).toBe(true);

    // datalistに無い国名(Bavaria)を含め、自由入力がバリデーションを通過することを実証。
    await page.fill("#cb-origin", "Bavaria, Germany");
    await page.fill("#cb-specialty", "Weisswurst");
    await page.click("#cb-submit");
    await expect(page.locator("#cb-err-origin")).toHaveText("");
    await expect(page.locator("#cb-err-specialty")).toHaveText("");
  });

  test("地図の器はページ読込直後からDOMに存在し、初期状態は非表示", async ({ page }) => {
    await page.goto("./post/");
    const map = page.locator("#cb-map");
    // 器そのものは存在する(沈黙no-opの再発防止・器を後付けしない)。
    await expect(map).toHaveCount(1);
    await expect(map).toBeHidden();
  });

  test("「地図を開く」操作で実際に地図(canvas)が描画される", async ({ page }) => {
    await page.goto("./post/");
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
    await page.goto("./post/");

    // カウンタの初期取得(db.count())完了を待ってから基準値を取る。
    const counter = page.locator("#cb-count");
    await expect.poll(async () => counter.textContent(), { timeout: 15_000 }).not.toBe(null);
    const countBefore = await counter.textContent();

    // 地図タブを先に開き、地図側のWS購読を確立してから実投稿件数の基準値を読む
    // (このE2E投稿自身が地図に反映されたことを確認するための下準備)。
    await page.click("#cb-map-toggle");
    const status = page.locator("#cb-map .fb-chart__total");
    await expect(status).toContainText(/地図に表示中/, { timeout: 15_000 });
    const realCountBefore = parseRealCount(await status.textContent());

    // 会場の生データと混同されぬよう明示的にE2Eタグを付ける
    // (家老指示の既存運用: subtask_751系のテスト投稿と同じ命名規則)。
    const origin = "E2E-テスト県";
    const specialty = "E2E-automated-test（自動テスト・削除予定）";

    const createRequest = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/ngsi-ld/v1/entities"),
    );

    await page.fill("#cb-origin", origin);
    await page.fill("#cb-specialty", specialty);
    await page.click("#cb-submit");

    // 投稿はNGSI-LDエンティティとして送信される(idはクライアント側で生成済み)。
    // 実バックエンドへ残さぬよう、成功・失敗を問わず必ず削除する(CodeRabbit指摘)。
    const created = await createRequest;
    const entityId = (created.postDataJSON() as { id: string }).id;

    try {
      await expect(page.locator("#cb-submit")).toHaveText(/Submitted! Thank you/, { timeout: 15_000 });

      // カウンタが基準値から増える(WS/count再取得いずれかで反映)。
      await expect
        .poll(async () => counter.textContent(), { timeout: 15_000 })
        .not.toBe(countBefore);

      // 地図側の実投稿件数が基準値より増えている
      // (単に「地図に表示中」文言が出るだけでなく、今回の投稿自身の反映を確認する)。
      await expect
        .poll(async () => parseRealCount(await status.textContent()), { timeout: 15_000 })
        .toBeGreaterThan(realCountBefore);
    } finally {
      await page.evaluate((id) => window.__contributionDb?.deleteEntity(id), entityId);
    }
  });
});
