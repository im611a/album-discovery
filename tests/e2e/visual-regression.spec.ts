import { expect, test } from "@playwright/test";

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
}

test.describe("V1.1 visual baselines", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns the pixel baselines.");

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`home ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/?visualTest=1");
      await settle(page);
      await expect(page).toHaveScreenshot(`home-${viewport.width}x${viewport.height}.png`);
    });
  }

  for (const route of [
    { name: "discover", path: "/discover/" },
    { name: "album-detail", path: "/albums/ok-computer/" },
  ]) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      test(`${route.name} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`${route.path}?visualTest=1`);
        await settle(page);
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.width}x${viewport.height}.png`);
      });
    }
  }
});
