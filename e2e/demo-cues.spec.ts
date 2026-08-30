import { test, expect, type Page } from "@playwright/test";

/**
 * subtask_754d 検証項目 5: DEMO CUEの実行(沈黙no-op対策)。
 *
 * ★root cause(殿ご指摘2026-08-30): contributionMap.tsは #cb-map が無ければ
 * エラーも出さず静かにno-opする設計。目視・「エラー無し」では沈黙no-opを
 * 見抜けない。assertするしかない。
 *
 * ★実装調査済み(2026-08-30 754d統合検証): デッキ側のCUE②④は
 * クリック/タブ切替ではなく、src/deck/slides.ts の onSlideChange 通知を
 * src/demos/keynoteMap.ts が購読し、現在スライドの data-slide 値に応じて
 * #inset-map のモードを自動遷移させる設計(seed=hidden / harvest=full /
 * それ以外=inset)。よってCUEの検証はページ内クリックではなく
 * ArrowRight でのスライド送りで行う。フルスクリーン化はCSSクラスでなく
 * 直接のインラインstyle書き換え(#inset-mapのleft/top/right/bottom/zIndex)
 * のため `.map-fullscreen` 等のクラスセレクタは存在しない
 * (旧livedeck由来の想定と異なる・実装調査で確認済み)。
 *
 * 投稿ページ「地図を開く」操作(#cb-map-toggle→#cb-map→canvas)は
 * e2e/post-page.spec.ts で既に実assert済みにつき本specでは扱わない。
 */

async function gotoSlide(page: Page, base: string, targetSlug: string) {
  await page.goto(base + "#1", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 16; i++) {
    const slug = await page.locator(".slide.is-active").getAttribute("data-slide");
    if (slug === targetSlug) return;
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
  }
  throw new Error(`slide "${targetSlug}" に到達できなかった`);
}

for (const lang of ["en", "ja"] as const) {
  const base = lang === "en" ? "./" : "./ja/";

  test(`CUE①→②の境界(${lang}): seedスライドでは地図が隠れ、titleスライドで初めてinsetが現れる`, async ({ page }) => {
    await page.goto(base + "#1", { waitUntil: "load" });
    await page.waitForTimeout(1500);

    await expect(page.locator(".slide.is-active")).toHaveAttribute("data-slide", "seed");
    const insetOnSeed = page.locator("#inset-map");
    // hidden属性の有無だけでなく、実際に非表示(可視でない)ことをassertする。
    await expect(insetOnSeed).toBeHidden();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
    await expect(page.locator(".slide.is-active")).toHaveAttribute("data-slide", "title");

    const insetOnTitle = page.locator("#inset-map");
    await expect(insetOnTitle).toBeVisible();
    // 器(#inset-map)が見えるだけでなく、maplibre/geoloniaのcanvasが実際に
    // マウントされていることをassertする(器だけの沈黙no-op再発防止)。
    await expect(insetOnTitle.locator("#inset-map-canvas canvas")).toBeVisible({ timeout: 10_000 });
  });

  test(`CUE③(${lang}): revealスライドでreveal-jsonが空でなく描画されている`, async ({ page }) => {
    await gotoSlide(page, base, "reveal");
    const json = page.locator("#reveal-json");
    await expect(json).toBeVisible();
    const text = (await json.textContent())?.trim() ?? "";
    expect(text.length, "reveal-jsonが空(沈黙no-op)").toBeGreaterThan(0);
    expect(text, "JSON構造ですらない").toMatch(/"id"\s*:/);

    // ローカル検証環境はAPIキー未設定のため実データ取得は失敗し、静的サンプル
    // (Seeded example)にフォールバックする。フォールバック自体が正しく機能して
    // いること(空白のまま固まる沈黙no-opでないこと)をここでは確認する。
    const tag = page.locator("#reveal-tag");
    await expect(tag).toBeVisible();
    const tagText = (await tag.textContent())?.trim() ?? "";
    expect(tagText.length, "reveal-tagが空").toBeGreaterThan(0);
    console.log(`[754d CUE③実測 ${lang}] reveal-tag="${tagText}"`);
  });

  test(`CUE④(${lang}): harvestスライドで地図が実際にフルスクリーン化する`, async ({ page }) => {
    await gotoSlide(page, base, "harvest");
    await page.waitForTimeout(1200); // フルスクリーン遷移アニメ

    const inset = page.locator("#inset-map");
    await expect(inset).toBeVisible();
    const canvas = inset.locator("#inset-map-canvas canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    const box = await inset.boundingBox();
    const vp = page.viewportSize();
    expect(box, "#inset-mapのboundingBoxが取得できない").not.toBeNull();
    expect(vp, "viewportSizeが取得できない").not.toBeNull();
    const coversViewport =
      !!box && !!vp && box.width >= vp.width * 0.9 && box.height >= vp.height * 0.85;
    expect(
      coversViewport,
      `harvestスライドで#inset-mapがビューポートを覆っていない(box=${JSON.stringify(box)} vp=${JSON.stringify(vp)})——CUE④のフルスクリーン化が実際には起きていない疑い`,
    ).toBe(true);
  });
}
