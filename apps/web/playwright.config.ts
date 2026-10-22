import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:5173", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev:fixtures",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
