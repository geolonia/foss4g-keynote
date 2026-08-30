import { defineConfig } from "@playwright/test";

// geonicdb-console の playwright.config.ts の作法を踏襲:
// E2E_BASE_URL を渡すとローカル Vite dev server の代わりに任意環境で実行できる。
// ポートは既定 8745（origin 制限付き API キーと同じ・vite.config.ts 準拠）。
// 8745 を別プロセス（例: livedeck の dev server）が使っている場合は
// E2E_PORT で逃がせる（API キー未使用のローカル計測ではポートは任意）。
const port = Number(process.env.E2E_PORT || 8745);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: `npx vite --port ${port}`,
          port,
          timeout: 30_000,
          reuseExistingServer: false,
        },
      }),
});
