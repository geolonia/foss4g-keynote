import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    __contributionDb?: { deleteEntity(id: string): Promise<unknown> };
  }
}

/**
 * "地図に表示中: N 件（+仕込み M 件）..." または
 * "Showing on map: N (+M seed)..." から実投稿件数Nを取り出す
 * (PR#7で/postの既定言語が英語になったため両言語に対応)。
 */
function parseRealCount(text: string | null): number {
  const m = /(?:地図に表示中|Showing on map):\s*(\d+)/.exec(text ?? "");
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

    // 入力欄のplaceholderも言語切替に追従する(CodeRabbit指摘対応・cb-hiddenSpot漏れの再発防止)。
    await expect(page.locator("#cb-origin")).toHaveAttribute("placeholder", /香川県/);
    await expect(page.locator("#cb-specialty")).toHaveAttribute("placeholder", /讃岐うどん/);
    await expect(page.locator("#cb-hiddenSpot")).toHaveAttribute("placeholder", /まだ地図に載っていない場所/);

    // 動的レンダリングのエラーメッセージも切り替わる。
    await page.click("#cb-submit");
    await expect(page.locator("#cb-err-origin")).toHaveText(/出身地を入力してください/);

    // 元に戻せる。
    await page.click("#cb-lang-toggle");
    await expect(page.locator("h1")).toHaveText(/Your voice becomes data on the map/);
    await expect(page.locator("#cb-err-origin")).toHaveText(/Please enter where you're from/);
    await expect(page.locator("#cb-origin")).toHaveAttribute("placeholder", /Kagawa, Japan/);
    await expect(page.locator("#cb-specialty")).toHaveAttribute("placeholder", /Sanuki udon/);
    await expect(page.locator("#cb-hiddenSpot")).toHaveAttribute("placeholder", /place not on the map yet/);
  });

  test("言語切替: 送信失敗後に入力を修正してから切替えると、古いエラーを再表示しない(CodeRabbit指摘対応)", async ({
    page,
  }) => {
    await page.goto("./post/");
    await page.click("#cb-submit");
    await expect(page.locator("#cb-err-origin")).toHaveText(/Please enter where you're from/);

    // 入力を修正(有効化)してから言語を切り替える。
    await page.locator("#cb-origin").fill("Quebec, Canada");
    await page.click("#cb-lang-toggle");

    // 修正済みの現在値で再検証されるため、古い「未入力」エラーは残らない。
    await expect(page.locator("#cb-err-origin")).toHaveText("");
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
    // CodeRabbit指摘(PR#7): localhostのallowedOrigins拒否という外部要因に
    // 依存せず、createEntity(POST)自体をテスト内で決定的に失敗させる
    // (allowedOriginsが将来localhostを許可しても本テストは失敗状態へ到達し続ける)。
    await page.route("**/ngsi-ld/v1/entities", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await page.goto("./post/");
    await page.fill("#cb-origin", "France");
    await page.fill("#cb-specialty", "Fromage");
    await page.click("#cb-submit");
    await expect(page.locator("#cb-submit")).toHaveText(/Failed — please retry/, { timeout: 15_000 });

    await page.click("#cb-lang-toggle");
    await expect(page.locator("#cb-submit")).toHaveText(/投稿に失敗/);
  });

  test("言語切替: 地図が読込中/取得失敗の間も状態文言が上書きされず現在の言語で保たれる(CodeRabbit指摘対応)", async ({
    page,
  }) => {
    // CodeRabbit指摘(PR#7): localhostのWS認証失敗という外部要因に依存せず、
    // WS接続の起点(DPoP nonce取得)とREST fallback(GET entities)の両方を
    // テスト内で意図的にハングさせ、"読込中…"状態を決定的に維持する
    // (allowedOrigins/DPoPが将来localhostで通っても本テストは読込中を保ち続ける)。
    await page.route("**/auth/nonce", () => new Promise(() => {}));
    // getEntities()は?type=...&limit=...等のクエリ付きでリクエストされるため、
    // パス末尾一致のみで判定する(単一エンティティ取得の/entities/{id}とは
    // 末尾に"entities"が来ない点で区別できる)。
    await page.route(
      (url) => url.pathname.endsWith("/ngsi-ld/v1/entities"),
      (route) => (route.request().method() === "GET" ? new Promise(() => {}) : route.continue()),
    );
    await page.goto("./post/");
    await page.click("#cb-map-toggle");
    const status = page.locator("#cb-map .fb-chart__total");
    await expect(status).toHaveText("Loading…");

    await page.click("#cb-lang-toggle");
    await expect(status).toHaveText("読み込み中…");

    await page.click("#cb-lang-toggle");
    await expect(status).toHaveText("Loading…");
  });

  test("地図: 認証が一定時間内に解決しなければLoading…に永久固定されず明示的な失敗表示へ切り替わる(将軍裁定②・5件目の沈黙no-op対策)", async ({
    page,
  }) => {
    // /auth/nonceを恒久的にハングさせ、connect()のリトライ(connectRetry.ts)を
    // 何度繰り返しても真に解決しない状況を再現する。SDKの既知挙動として、
    // 認証失敗時のconnect()はPromiseをrejectせず'error'を emitするだけで
    // 終わるため、リトライしても状況が変わらない限り沈黙し続ける危険がある
    // ——それをwatchdogが安全網として断ち切ることを実証する。
    await page.route("**/auth/nonce", () => new Promise(() => {}));
    await page.route(
      (url) => url.pathname.endsWith("/ngsi-ld/v1/entities"),
      (route) => (route.request().method() === "GET" ? new Promise(() => {}) : route.continue()),
    );
    await page.goto("./post/");
    await page.click("#cb-map-toggle");
    const status = page.locator("#cb-map .fb-chart__total");
    await expect(status).toHaveText("Loading…");
    // MAP_LOADING_WATCHDOG_MS(12s)+接続jitter(最大5s)を超えて待ち、
    // Loading…に固定されないことを実証する。
    await expect(status).toHaveText("Failed to load data", { timeout: 25_000 });
  });

  test("カウンタ: 認証が一定時間内に解決しなければ初期値のまま固定されず明示的な取得失敗表示へ切り替わる(将軍裁定②・5件目の沈黙no-op対策)", async ({
    page,
  }) => {
    await page.route("**/auth/nonce", () => new Promise(() => {}));
    await page.route(
      (url) => url.pathname.endsWith("/ngsi-ld/v1/entities"),
      (route) => (route.request().method() === "GET" ? new Promise(() => {}) : route.continue()),
    );
    await page.goto("./post/");
    const count = page.locator("#cb-count");
    // COUNT_WATCHDOG_MS(12s)+接続jitter(最大5s)を超えて待ち、
    // 初期値のまま固定されないことを実証する。
    await expect(count).toHaveText("Live count unavailable", { timeout: 25_000 });

    await page.click("#cb-lang-toggle");
    await expect(count).toHaveText("件数を取得できませんでした");
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

    // CodeRabbit指摘(PR#7): "Bavaria, Germany"はdatalist自身に候補として
    // 含まれているため、候補外の自由入力を検証したことにならない。
    // datalistに存在しない値("Quebec, Canada")へ変更し、真に自由入力である
    // ことを検証する。
    await page.fill("#cb-origin", "Quebec, Canada");
    await page.fill("#cb-specialty", "Poutine");
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
    // PR#7で既定言語が英語になったため、両言語の表示文言を許容する。
    await expect(status).toContainText(/地図に表示中|Showing on map/, { timeout: 15_000 });
    const realCountBefore = parseRealCount(await status.textContent());

    // 会場の生データと混同されぬよう明示的にE2Eタグを付ける
    // (家老指示の既存運用: subtask_751系のテスト投稿と同じ命名規則)。
    // ★2026-09-01 root cause発見: originGeo.tsのresolveOriginCoords()は
    // 固定の都道府県/国名テーブルにしか一致しない設計(捏造しない=正)ゆえ、
    // 旧来の架空地名"E2E-テスト県"は永久に解決不能=地図の実表示件数に
    // 決して反映されず、下のtoBeGreaterThan(realCountBefore)アサートが
    // 原理的に成立しなかった(テスト設計側の欠陥・アプリ欠陥ではない)。
    // 識別はspecialty文言(ashigaru4の削除依頼はこちらを鍵にしている)で
    // 行うため、originは解決可能な実国名へ差し替える。
    const origin = "スイス";
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

    // CodeRabbit指摘(2回目): finally節でthrowすると、try節のassert失敗
    // (=本来報告すべきテスト失敗)をcleanup例外が上書きしてしまう
    // (noUnsafeFinally)。よってfinallyは使わず、try節の例外を変数に
    // 保持した上でcleanupを常に実行し、最後にどちらを投げるか判定する。
    let submissionError: unknown;
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
    } catch (err) {
      submissionError = err;
    }

    // CONTRIBUTION_KEY(このページが使う統合キー)には削除権限が無いため、
    // ここでのdeleteEntity失敗(403等)はアプリ側の欠陥ではない。
    // 上のassert(投稿→カウンタ/地図反映の確認)を弱めぬよう、
    // cleanup失敗はテストを失敗させず、ashigaru4への手動削除依頼として
    // ログに残すのみとする。
    // page.evaluate は browser側の Error subclass(AuthorizationError等)を
    // そのまま Node側へ instanceof 可能な形で渡さない(realmを跨ぐため)。
    // よって statusCode を明示的に持ち帰り、403(=権限不足=想定内)のみ
    // 警告に留め、それ以外(ネットワーク障害・404等)は再送出してテストを
    // 失敗させる(CodeRabbit指摘1回目: cleanup失敗の握りつぶし過ぎを防止)。
    // ★CodeRabbit指摘3回目: page.evaluate自体がブラウザ切断/execution
    // context破棄でrejectした場合、コールバック内のtry/catchは効かず
    // Node側でそのままthrowされ、既にあるsubmissionErrorを上書きしうる。
    // .catch()でevaluate全体のrejectもcleanupResultと同じ形に正規化する。
    const cleanupResult = await page
      .evaluate(async (id) => {
        try {
          await window.__contributionDb?.deleteEntity(id);
          return { ok: true as const };
        } catch (err) {
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          return { ok: false as const, statusCode, message: String(err) };
        }
      }, entityId)
      .catch((err) => ({ ok: false as const, statusCode: undefined, message: String(err) }));

    if (!cleanupResult.ok) {
      if (cleanupResult.statusCode === 403) {
        // eslint-disable-next-line no-console
        console.warn(
          `[E2E cleanup] entity ${entityId} の自動削除に失敗した` +
            `(CONTRIBUTION_KEYには削除権限が無いため想定内・403)。` +
            `ashigaru4へ手動削除を依頼されたし: ${cleanupResult.message}`,
        );
      } else if (submissionError) {
        // 元のassert失敗を優先して報告する。cleanup失敗は握りつぶさず
        // 併記のみ行う(元の例外を上書きしない)。
        // eslint-disable-next-line no-console
        console.error(
          `[E2E cleanup] entity ${entityId} の削除も403以外の理由で失敗した` +
            `(元のテスト失敗に追加で発生・テストデータが残存する可能性): ${cleanupResult.message}`,
        );
      } else {
        submissionError = new Error(
          `[E2E cleanup] entity ${entityId} の削除が403以外の理由で失敗した` +
            `(想定外・テストデータが残存する可能性): ${cleanupResult.message}`,
        );
      }
    }

    if (submissionError) throw submissionError;
  });
});
