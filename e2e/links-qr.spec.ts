import { test, expect } from "@playwright/test";
import { decodeQrFromLocator } from "./lib/qr";

/**
 * subtask_754d 検証項目 4: 全リンク・全QRの着地確認。
 *   (a) QR画像を実ピクセルからデコードしてURLを取り出す(aria-label/alt厳禁)
 *   (b) page.goto() で実際にそのURLへ着地する
 *   (c) 着地先に期待する要素が存在することをassertする
 *
 * href/aria-labelを目で読んで「正しそう」と判定するのは禁止
 * (2026-08-30 keynote QR誤り事案の再発防止・cmd_754追補)。
 *
 * ★TODO(754d-integration): 実デッキ着地後、LINKS配列を実際のQR/リンク一覧で埋める。
 * 各エントリの `expectSelector` は着地先ページで実際に見えるべき要素。
 */
interface LinkCheck {
  name: string;
  /** QR画像のlocatorセレクタ、またはリンク要素(<a>)のセレクタ。 */
  selector: string;
  kind: "qr-image" | "anchor-href";
  /** 着地後にassertする要素セレクタ。 */
  expectSelector: string;
}

const LINKS: LinkCheck[] = [
  // 例(実装後に差し替え):
  // { name: "cover-qr-talk", selector: "#cover-qr img", kind: "qr-image", expectSelector: "#cb-form" },
];

test.describe("全リンク・全QRの着地確認 (復号→取得→要素assert)", () => {
  test.skip(!process.env.E2E_754D_DECK_READY || LINKS.length === 0, "LINKS未確定・index.html着地待ち");

  for (const link of LINKS) {
    test(`${link.name}: 実際に着地し期待要素が存在する`, async ({ page }) => {
      await page.goto("/");

      let destinationUrl: string;
      if (link.kind === "qr-image") {
        const decoded = await decodeQrFromLocator(page.locator(link.selector));
        expect(decoded, `QRデコード失敗: ${link.selector}`).toBeTruthy();
        destinationUrl = decoded!;
      } else {
        const href = await page.locator(link.selector).getAttribute("href");
        expect(href, `href取得失敗: ${link.selector}`).toBeTruthy();
        destinationUrl = href!;
      }

      await page.goto(destinationUrl);
      await expect(page.locator(link.expectSelector)).toBeVisible();
    });
  }
});
