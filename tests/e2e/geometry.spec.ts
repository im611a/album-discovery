import { expect, test, type Page } from "@playwright/test";

type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };

function intersectionArea(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

async function assertGalleryGeometry(page: Page) {
  const geometry = await page.locator("[data-motion-gallery-item][data-revealed=true]").evaluateAll((items) =>
    items.map((item) => {
      const cover = item.querySelector<HTMLElement>(".editorial-album-object__cover");
      if (!cover) throw new Error("Gallery item is missing its cover link.");
      const rect = cover.getBoundingClientRect();
      return {
        allowOverlap: item.getAttribute("data-overlap") === "true",
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      };
    }),
  );
  expect(geometry.length).toBeGreaterThan(1);
  for (const item of geometry) {
    expect(item.rect.left).toBeGreaterThanOrEqual(-1);
    expect(item.rect.right).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1);
  }
  for (let left = 0; left < geometry.length; left += 1) {
    for (let right = left + 1; right < geometry.length; right += 1) {
      const overlap = intersectionArea(geometry[left].rect, geometry[right].rect);
      if (!geometry[left].allowOverlap && !geometry[right].allowOverlap) expect(overlap).toBeLessThanOrEqual(1);
      else expect(overlap).toBeLessThanOrEqual(Math.min(
        geometry[left].rect.width * geometry[left].rect.height,
        geometry[right].rect.width * geometry[right].rect.height,
      ) * .15);
    }
  }
}

test.describe("editorial geometry regression", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns precise geometry evidence.");
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`${viewport.width}x${viewport.height} keeps gallery geometry legal across pointer positions`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.evaluate(() => window.scrollTo(0, 720));
      await expect.poll(() => page.locator("[data-motion-gallery-item][data-revealed=true]").count()).toBeGreaterThan(1);
      const gallery = page.locator("[data-motion-gallery]");
      const box = await gallery.boundingBox();
      expect(box).not.toBeNull();
      for (const [x, y] of [[.1, .1], [.9, .1], [.5, .5], [.1, .9], [.9, .9]]) {
        await page.mouse.move(box!.x + box!.width * x, Math.min(viewport.height - 16, box!.y + box!.height * y));
        await page.waitForTimeout(180);
        await assertGalleryGeometry(page);
      }
      const headerBottom = await page.locator(".site-header").evaluate((element) => element.getBoundingClientRect().bottom);
      const coverTops = await page.locator("[data-motion-gallery-item][data-revealed=true]").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
      expect(coverTops.every((top) => top >= headerBottom - 1)).toBe(true);
    });
  }
});
