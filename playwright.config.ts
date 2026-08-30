import { defineConfig } from "@playwright/test";

// geonicdb-console の e2e 構成に倣う（E2E_BASE_URL で外部環境も検証可能にする）。
const baseURL = process.env.E2E_BASE_URL || "http://localhost:8745";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
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
          command: "npx vite --port 8745",
          port: 8745,
          timeout: 30_000,
          reuseExistingServer: false,
        },
      }),
});
