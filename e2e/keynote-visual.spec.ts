/* ===================================================================
   cmd_754 視覚の定量ゲート（殿ご下命: ソース grep でなく描画後 DOM を数える）
   +全スライドのスクリーンショット採取（投影解像度 1920×1080・モバイル）。

   ゲート（acceptance_criteria）:
   - (a) svg 10 個以上（描画後 DOM の <svg> 実数）
   - (b) 図版・画像・実データ表示のいずれかを持つスライド 14 枚以上
   - (c) 文字のみのスライド 2 枚以下

   ★スライド送りは実運転と同じキーボード（ArrowRight）で行う。
     deck（src/deck/slides.ts）は URL ハッシュを初期化時にしか読まないため、
     location.hash の書き換えでは再 render されない——hash 書き換え方式は
     全スライドがスライド 1 のまま計測される偽陽性を生む（実測で確認済み）。

   計測は「スライド内の静的な図版要素」（svg / img / canvas / pre.fb-json /
   .metric 実データタイル）で行う。常駐ミニマップ（スライド外の固定要素・
   スライド 2 以降ずっと可視）はゲート判定に含めない＝保守的な数え方とし、
   可視状態だけ別掲する。

   スクリーンショット出力先は SHOTS_DIR 環境変数（既定 ./e2e-shots）。
   =================================================================== */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHOTS_DIR = process.env.SHOTS_DIR || "e2e-shots";
const SLIDE_COUNT = 16;

// 16 枚の正順スラグ（台本 SLIDE 1〜16 対応）。送りのズレをここで検知する。
const EXPECTED_SLUGS = [
  "seed", "title", "decade", "meaning-gap", "reveal", "objection", "facts",
  "bet", "requirements", "geonicdb-onepage", "cost-bought", "etsi-conformance",
  "payoff", "harvest", "meta-point", "closing",
];

interface SlideStat {
  n: number;
  slug: string;
  svg: number;
  img: number;
  canvas: number;
  dataViz: number; // .metric 実データタイル + ライブ JSON (pre.fb-json)
  hasFigure: boolean;
  insetVisible: boolean;
}

/** スライド 1 から ArrowRight で送りながら、計測とスクリーンショットを 1 周で行う。 */
async function walkDeck(
  page: Page,
  base: string,
  shotsDir: string | null,
): Promise<SlideStat[]> {
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  await page.goto(base + "#1", { waitUntil: "load" });
  await page.waitForTimeout(2500); // フォント・地図ライブラリ・初期描画

  const stats: SlideStat[] = [];
  for (let n = 1; n <= SLIDE_COUNT; n++) {
    if (n > 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1100); // 遷移アニメ+ライブ要素の描画
    }
    const active = page.locator(".slide.is-active");
    await expect(active).toHaveCount(1);
    const slug = (await active.getAttribute("data-slide")) ?? "";
    expect(slug, `slide ${n} slug`).toBe(EXPECTED_SLUGS[n - 1]);

    const svg = await active.locator("svg").count();
    const img = await active.locator("img").count();
    let canvas = await active.locator("canvas").count();
    const dataViz =
      (await active.locator(".metric").count()) + (await active.locator("pre.fb-json").count());
    const insetVisible = (await page.locator("#inset-map:not([hidden])").count()) > 0;
    if (slug === "harvest") {
      // CUE④: このスライドの図版は「全画面化したライブ地図」そのもの
      // （スライド外の固定要素ゆえ active 内には現れない）。canvas が実在し、
      // かつ地図パネルがビューポートの大半を覆っていることを確認して算入する。
      const mapCanvas = await page.locator("#inset-map canvas").count();
      const box = await page.locator("#inset-map").boundingBox();
      const vp = page.viewportSize();
      const coversViewport =
        !!box && !!vp && box.width >= vp.width * 0.9 && box.height >= vp.height * 0.85;
      expect(mapCanvas, "harvest: full-screen map canvas exists").toBeGreaterThanOrEqual(1);
      expect(coversViewport, "harvest: map covers the viewport").toBe(true);
      canvas += mapCanvas;
    }
    stats.push({ n, slug, svg, img, canvas, dataViz, hasFigure: svg + img + canvas + dataViz > 0, insetVisible });

    if (shotsDir) {
      await page.screenshot({
        path: join(shotsDir, `slide-${String(n).padStart(2, "0")}.png`),
        fullPage: false,
      });
    }
  }
  return stats;
}

for (const lang of ["en", "ja"] as const) {
  const base = lang === "en" ? "./" : "./ja/";

  test(`visual quantitative gate + projection screenshots (${lang}, 1920x1080)`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const stats = await walkDeck(page, base, join(SHOTS_DIR, `${lang}-1920x1080`));

    // 描画後 DOM 全体の <svg> 実数（デッキは全スライドを DOM に持つ）
    const deckSvgTotal = await page.locator("#deck svg").count();
    const pageSvgTotal = await page.locator("svg").count();
    const figureSlides = stats.filter((s) => s.hasFigure);
    const textOnly = stats.filter((s) => !s.hasFigure);
    const insetOnSlides = stats.filter((s) => s.insetVisible).map((s) => s.n);

    const summary = {
      lang,
      deckSvgTotal,
      pageSvgTotal,
      figureSlideCount: figureSlides.length,
      textOnlySlideCount: textOnly.length,
      textOnlySlugs: textOnly.map((s) => s.slug),
      insetMapVisibleOnSlides: insetOnSlides,
      perSlide: stats,
    };
    mkdirSync(SHOTS_DIR, { recursive: true });
    writeFileSync(join(SHOTS_DIR, `gate-${lang}.json`), JSON.stringify(summary, null, 2));
    console.log(
      `[gate:${lang}] svg(deck)=${deckSvgTotal} svg(page)=${pageSvgTotal} ` +
      `figureSlides=${figureSlides.length}/16 textOnly=${textOnly.length} ` +
      `(${summary.textOnlySlugs.join(",")}) inset=[${insetOnSlides.join(",")}]`,
    );

    // --- ゲート判定（ミニマップを含めない保守的な数え方） ---
    expect(deckSvgTotal, "svg >= 10 (deck DOM, rendered)").toBeGreaterThanOrEqual(10);
    expect(figureSlides.length, "slides with figure >= 14").toBeGreaterThanOrEqual(14);
    expect(textOnly.length, "text-only slides <= 2").toBeLessThanOrEqual(2);
  });

  test(`mobile screenshots (${lang}, 844x390 landscape + portrait rotate-hint)`, async ({ page }) => {
    // 横長デッキゆえモバイルは横向きで実表示を撮る。縦向きは rotate-hint が
    // 出る仕様なので、その証跡を 1 枚だけ撮る。
    await page.setViewportSize({ width: 844, height: 390 });
    const dir = join(SHOTS_DIR, `${lang}-mobile-844x390`);
    await walkDeck(page, base, dir);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "#2", { waitUntil: "load" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(dir, "portrait-rotate-hint.png") });
  });
}
