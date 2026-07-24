import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const evidenceRoot = path.resolve(".local-data/v1.1-full-site-acceptance");
const keyframeRoot = path.join(evidenceRoot, "keyframes");

async function saveVideo(
  browser: Browser,
  baseURL: string,
  name: string,
  viewport: { width: number; height: number },
  perform: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: path.join(evidenceRoot, ".video-work"), size: viewport },
  });
  const page = await context.newPage();
  const video = page.video();
  await page.goto(`${baseURL}/`);
  await perform(page);
  await page.close();
  await context.close();
  const videoPath = await video?.path();
  if (!videoPath) throw new Error(`Video was not produced for ${name}.`);
  await copyFile(videoPath, path.join(evidenceRoot, name));
}

test.describe("V1.1 acceptance evidence", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns local motion evidence.");

  test("records continuous motion evidence", async ({ browser }, testInfo) => {
    await mkdir(keyframeRoot, { recursive: true });
    const baseURL = String(testInfo.project.use.baseURL);
    await saveVideo(browser, baseURL, "desktop-home-motion.webm", { width: 1440, height: 900 }, async (page) => {
      for (const [index, y] of [0, 240, 480, 720, 960, 1_240].entries()) {
        await page.evaluate((nextY) => window.scrollTo({ top: nextY, behavior: "smooth" }), y);
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(keyframeRoot, `home-scroll-${String(index).padStart(2, "0")}.png`) });
      }
    });
    await saveVideo(browser, baseURL, "desktop-pointer-parallax.webm", { width: 1440, height: 900 }, async (page) => {
      await page.evaluate(() => window.scrollTo(0, 720));
      const box = await page.locator("[data-motion-gallery]").boundingBox();
      expect(box).not.toBeNull();
      for (const [x, y] of [[.1, .1], [.9, .1], [.5, .5], [.1, .9], [.9, .9]]) {
        await page.mouse.move(box!.x + box!.width * x, Math.min(880, box!.y + box!.height * y), { steps: 12 });
        await page.waitForTimeout(320);
      }
    });
    await saveVideo(browser, baseURL, "desktop-featured-deck.webm", { width: 1440, height: 900 }, async (page) => {
      const deck = page.locator("[data-motion-deck]");
      const box = await deck.boundingBox();
      expect(box).not.toBeNull();
      for (const ratio of [.05, .48, .86]) {
        await page.evaluate((target) => window.scrollTo({ top: target, behavior: "smooth" }), box!.y + box!.height * ratio);
        await page.waitForTimeout(650);
      }
    });
    await saveVideo(browser, baseURL, "mobile-home-scroll.webm", { width: 390, height: 844 }, async (page) => {
      for (const y of [0, 420, 840, 1_260, 1_680]) {
        await page.evaluate((nextY) => window.scrollTo({ top: nextY, behavior: "smooth" }), y);
        await page.waitForTimeout(420);
      }
    });
    await rm(path.join(evidenceRoot, ".video-work"), { recursive: true, force: true });
  });

  test("captures required homepage states", async ({ page }) => {
    await mkdir(evidenceRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.screenshot({ path: path.join(evidenceRoot, "home-initial.png") });
    await page.evaluate(() => window.scrollTo(0, 720));
    await expect.poll(() => page.locator("[data-motion-gallery-item][data-revealed=true]").count()).toBeGreaterThan(1);
    await page.screenshot({ path: path.join(evidenceRoot, "home-gallery-complete.png") });
    const box = await page.locator("[data-motion-gallery]").boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * .1, Math.min(880, box!.y + box!.height * .5));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(evidenceRoot, "home-pointer-left.png") });
    await page.mouse.move(box!.x + box!.width * .9, Math.min(880, box!.y + box!.height * .5));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(evidenceRoot, "home-pointer-right.png") });
    const deck = page.locator("[data-motion-deck]");
    const deckBox = await deck.boundingBox();
    expect(deckBox).not.toBeNull();
    for (const [index, ratio] of [[1, .05], [2, .48], [3, .86]] as const) {
      await page.evaluate((target) => window.scrollTo(0, target), deckBox!.y + deckBox!.height * ratio);
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(evidenceRoot, `home-deck-${String(index).padStart(2, "0")}.png`) });
    }
  });

  test("captures representative full-site pages", async ({ page }) => {
    await mkdir(evidenceRoot, { recursive: true });
    const cases = [
      ["discover-desktop.png", "/discover/?visualTest=1", 1440, 900],
      ["discover-mobile.png", "/discover/?visualTest=1", 390, 844],
      ["search-desktop.png", "/search/?q=Radiohead&visualTest=1", 1440, 900],
      ["search-mobile.png", "/search/?q=王菲&visualTest=1", 390, 844],
      ["artist-index-desktop.png", "/artists/?visualTest=1", 1440, 900],
      ["artist-detail-desktop.png", "/artists/artist-6452/?visualTest=1", 1440, 900],
      ["artist-detail-mobile.png", "/artists/artist-6452/?visualTest=1", 390, 844],
      ["album-detail-desktop.png", "/albums/ok-computer/?visualTest=1", 1440, 900],
      ["album-detail-mobile.png", "/albums/ok-computer/?visualTest=1", 390, 844],
      ["explore-desktop.png", "/explore/?visualTest=1", 1440, 900],
      ["my-albums-mobile.png", "/library/?visualTest=1", 390, 844],
      ["topic-desktop.png", "/genres/core/pop/?visualTest=1", 1440, 900],
      ["topic-mobile.png", "/genres/core/pop/?visualTest=1", 390, 844],
      ["settings-mobile.png", "/settings/?visualTest=1", 390, 844],
      ["about-desktop.png", "/about/?visualTest=1", 1440, 900],
      ["not-found-mobile.png", "/albums/not-a-real-album/?visualTest=1", 390, 844],
    ] as const;
    for (const [name, route, width, height] of cases) {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      await page.screenshot({ path: path.join(evidenceRoot, name), fullPage: true });
    }
  });
});
