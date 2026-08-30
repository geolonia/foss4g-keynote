/**
 * QR ピクセルデコードのヘルパ(subtask_754d)。
 *
 * ★殿の指示: aria-label/alt テキストを信用するな。実際に描画された QR の
 * ピクセルパターンを画像デコードして符号化 URL を独立に取り出せ
 * (2026-08-30 keynote QR誤り事案・cmd_754追補)。
 *
 * Node ネイティブな jsQR + pngjs で完結させる(Python/pyzbar 不要)。
 */
import { PNG } from "pngjs";
import jsQR from "jsqr";

/** PNG バイト列(Buffer)から QR コードのペイロード文字列を取り出す。読めなければ null。 */
export function decodeQrFromPng(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result ? result.data : null;
}

/**
 * Playwright の ElementHandle/Locator が指す要素(通常は <img> か <canvas>)を
 * スクリーンショットし、そのピクセルから QR ペイロードをデコードする。
 * aria-label 等のテキスト属性は一切読まない。
 */
export async function decodeQrFromLocator(locator: {
  screenshot: () => Promise<Buffer>;
}): Promise<string | null> {
  const buffer = await locator.screenshot();
  return decodeQrFromPng(buffer);
}
