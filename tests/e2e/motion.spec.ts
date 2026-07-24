import { expect, test, type Page } from "@playwright/test";

async function galleryState(page: Page) {
  return page.locator("[data-motion-gallery-item]").evaluateAll((items) => ({
    revealed: items.filter((item) => item.getAttribute("data-revealed") === "true").length,
    progresses: items.map((item) => Number(getComputedStyle(item).getPropertyValue("--gallery-item-progress"))),
  }));
}

test.describe("home editorial motion contract", () => {
  test("reveals covers from zero with reversible native scroll", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Firefox motion evidence is best effort in this Windows environment.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("[data-editorial-motion]")).toHaveAttribute("data-motion-mode", "full");
    expect((await galleryState(page)).revealed).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 650));
    await expect.poll(async () => (await galleryState(page)).revealed).toBeGreaterThan(0);
    const forward = await galleryState(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await galleryState(page)).revealed).toBe(0);
    const reverse = await galleryState(page);
    expect(Math.max(...forward.progresses)).toBeGreaterThan(Math.max(...reverse.progresses));
  });

  test("uses one settling RAF for five pointer positions", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Pointer depth is a desktop Chromium evidence path.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(async () => (await galleryState(page)).revealed).toBeGreaterThan(1);
    const gallery = page.locator("[data-motion-gallery]");
    const box = await gallery.boundingBox();
    expect(box).not.toBeNull();
    const transforms = [];
    for (const [x, y] of [[.1, .1], [.9, .1], [.5, .5], [.1, .9], [.9, .9]]) {
      await page.mouse.move(box!.x + box!.width * x, Math.min(box!.y + box!.height * y, 850));
      await page.waitForTimeout(180);
      transforms.push(await page.locator("[data-motion-gallery-item][data-revealed=true]").first().evaluate((item) => getComputedStyle(item).transform));
    }
    expect(new Set(transforms).size).toBeGreaterThan(2);
    await page.waitForTimeout(1_200);
    await expect(page.locator("[data-editorial-motion]")).toHaveAttribute("data-raf-active", "false");
  });

  test("keeps deck number, cover and vinyl on one active index", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Firefox motion evidence is best effort in this Windows environment.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const deck = page.locator("[data-motion-deck]");
    const box = await deck.boundingBox();
    expect(box).not.toBeNull();
    for (const [ratio, index] of [[.05, "0"], [.48, "1"], [.86, "2"]] as const) {
      await page.evaluate((target) => window.scrollTo(0, target), box!.y + box!.height * ratio);
      await expect(page.locator("[data-editorial-motion]")).toHaveAttribute("data-deck-index", index);
      await expect(page.locator("[data-motion-deck-item][data-active=true]")).toHaveCount(1);
      await expect(page.locator("[data-motion-deck-item][data-active=true] .featured-deck__number"))
        .toHaveText(`/${String(Number(index) + 1).padStart(2, "0")}`);
    }
  });

  test("reduced motion shows the complete static gallery and deck", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("[data-editorial-motion]")).toHaveAttribute("data-motion-mode", "reduced");
    await expect(page.locator("[data-motion-gallery-item]")).toHaveCount(9);
    await expect(page.locator("[data-motion-gallery-item] a").first()).not.toHaveAttribute("tabindex", "-1");
    await expect(page.locator("[data-motion-deck-item]")).toHaveCount(3);
  });

  test("no JavaScript keeps static content and album links available", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "专辑发现" })).toBeVisible();
    await expect(page.locator("[data-motion-gallery-item]")).toHaveCount(9);
    await expect(page.locator("[data-motion-gallery-item] a").first()).toBeVisible();
    await context.close();
  });

  test("history restoration preserves deck state after detail navigation", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "History scroll restoration is owned by Chromium.");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const deck = page.locator("[data-motion-deck]");
    const box = await deck.boundingBox();
    await page.evaluate((target) => window.scrollTo(0, target), box!.y + box!.height * .48);
    await expect(page.locator("[data-editorial-motion]")).toHaveAttribute("data-deck-index", "1");
    const before = await page.evaluate(() => window.scrollY);
    await page.locator("[data-motion-deck-item][data-active=true] .featured-deck__cover").click();
    await page.goBack();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 120);
    await expect(page.locator("[data-editorial-motion]")).toHaveAttribute("data-deck-index", "1");
  });
});
