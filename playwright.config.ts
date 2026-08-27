import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4311";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? ".local-data/playwright-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.012,
    },
  },
  use: {
    baseURL,
    colorScheme: "dark",
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "msedge" },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
});
