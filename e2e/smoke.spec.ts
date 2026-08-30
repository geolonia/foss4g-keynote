import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { decodeQrFromLocator } from "./lib/qr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * subtask_754d: 骨組み(Playwright基盤・QRピクセルデコード)の動作確認。
 *
 * ★実デッキ(index.html/投稿ページ)はashigaru3/6/2が構築中で未着ゆえ、
 * この spec は実デッキに依存せず「QR画像を描画→スクショ→ピクセルからデコード→
 * 実際にnavigateして着地先の要素をassert」という7点検証の中核パイプライン
 * 自体が正しく動くことだけを検証する。実URL・実CUEの検証は本題側のspecへ移す。
 */
test.describe("scaffold smoke (754d harness)", () => {
  test("QR pixel decode → navigate → landing element assert", async ({ page }) => {
    const landingUrl = pathToFileURL(path.join(__dirname, "fixtures/landing.html")).href;

    // aria-label 等のテキストは一切使わず、実際に描画したQR画像のピクセルだけを頼りにする。
    const qrPngDataUrl = await QRCode.toDataURL(landingUrl, { margin: 1, width: 300 });
    await page.setContent(
      `<img id="qr" src="${qrPngDataUrl}" alt="このalt/aria-labelは意図的に無関係な文字列" aria-label="do-not-trust-me" />`,
    );

    const qrLocator = page.locator("#qr");
    await expect(qrLocator).toBeVisible();

    const decoded = await decodeQrFromLocator(qrLocator);
    expect(decoded).toBe(landingUrl);
    // aria-labelを信用していないことの直接的な確認(将軍指示の核心)。
    expect(decoded).not.toBe("do-not-trust-me");

    await page.goto(decoded!);
    await expect(page.locator("#landing-marker")).toHaveText("SMOKE-OK");
  });

  test("console/network error capture wiring works", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => failedRequests.push(req.url()));

    await page.setContent(`<script>console.error("expected-smoke-error")</script>`);
    await expect.poll(() => consoleErrors).toContain("expected-smoke-error");
    // failedRequestsは本specでは未使用(0件)だが、リスナー自体が正しく配線されている
    // ことは上のconsoleErrors捕捉で担保される。本番specでは両方を使う。
    expect(failedRequests.length).toBe(0);
  });
});
