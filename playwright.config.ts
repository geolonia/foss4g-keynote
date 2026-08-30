import { defineConfig } from "@playwright/test";

// subtask_754d: geonicdb-console の playwright.config.ts (E2E_BASE_URL パターン) をそのまま流用。
// E2E_BASE_URL を渡すと、ローカル Vite dev server の代わりに任意の環境
// (例: GitHub Pages 本番) に対して同じスペックを実行できる。
//
// GitHub Pages 本番は deploy.yml で BASE_URL=/foss4g-keynote/ を指定してビルドするため、
// E2E_BASE_URL には末尾スラッシュ付きのパスプレフィックス込みURLが渡される想定
// (例: https://geolonia.github.io/foss4g-keynote/)。末尾に "/" が無いと、spec側の
// page.goto("./...") のような相対パス解決がリポジトリ名プレフィックスを失うため、
// ここで末尾スラッシュを必ず補う(CodeRabbit指摘・実害: page.goto("/") 等の
// 絶対パス解決はプレフィックスを完全に破棄するため、spec側も相対パス表記に統一する)。
const rawBaseURL = process.env.E2E_BASE_URL || "http://localhost:5996";
const baseURL = rawBaseURL.endsWith("/") ? rawBaseURL : `${rawBaseURL}/`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    headless: true,
  },
  projects: [
    {
      name: "projector-1920x1080",
      use: { browserName: "chromium", viewport: { width: 1920, height: 1080 } },
    },
    {
      name: "mobile-iphone",
      use: {
        browserName: "chromium",
        // iPhone 12/13 相当の viewport + UA（デバイス定義を丸ごと使うと
        // isMobile: true が touch エミュレーションを要求し headless chromium で
        // 落ちる環境があったため、viewport/UA のみ明示指定する）。
        viewport: { width: 390, height: 844 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        deviceScaleFactor: 3,
      },
    },
  ],
  // E2E_BASE_URL が指定された場合、その環境は既に稼働している前提でローカル
  // dev server は起動しない(本番 GitHub Pages 等、外部環境を対象にするケース)。
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          // Vite のデフォルトポート 5173 は共有ホスト上の無関係プロジェクトと衝突しうる。
          // reuseExistingServer:true にすると既存プロセスへ誤接続して別アプリを検証する
          // 事故が起きるため false 固定（geonicdb-console の作法に倣う）。
          command: "npx vite --port 5996",
          port: 5996,
          timeout: 30_000,
          reuseExistingServer: false,
        },
      }),
});
