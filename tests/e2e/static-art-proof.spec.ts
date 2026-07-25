import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const proofRoot = path.resolve(".local-data/v1.1-physical-archive/static-art-proof");

test.describe("physical archive static art proof", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns static art proof screenshots.");

  for (const viewport of [
    { width: 1920, height: 1080, name: "home-1920" },
    { width: 1440, height: 900, name: "home-1440" },
    { width: 390, height: 844, name: "home-390" },
  ]) {
    test(`${viewport.name} renders the complete static archive`, async ({ page }) => {
      await mkdir(proofRoot, { recursive: true });
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator("[data-ring-cabinet]")).toBeVisible();
      await expect(page.locator(".pa-cabinet-slot")).toHaveCount(6);
      await expect(page.locator(".pa-featured-scene")).toHaveCount(3);
      await expect(page.locator(".home-gallery")).toHaveCount(0);
      await page.screenshot({
        path: path.join(proofRoot, `${viewport.name}-full.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: path.join(proofRoot, `${viewport.name}-opening.png`),
      });
    });
  }

  test("captures all three stable featured scenes", async ({ page }) => {
    await mkdir(proofRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const scenes = page.locator(".pa-featured-scene");
    for (let index = 0; index < 3; index += 1) {
      const scene = scenes.nth(index);
      await scene.scrollIntoViewIfNeeded();
      await expect(scene.locator(".pa-package")).toHaveCount(3);
      await expect(scene.locator(".pa-package[data-position=active]")).toHaveCount(1);
      await scene.screenshot({ path: path.join(proofRoot, `featured-${index + 1}.png`) });
    }
  });
});
