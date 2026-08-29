import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resolveRegressionEvidenceRoot } from "./helpers/evidence-output";

const evidenceRoot = resolveRegressionEvidenceRoot({
  phase: "album-discovery-experience-v1-full-site",
  environmentValue: process.env.ALBUM_DISCOVERY_EVIDENCE_DIR,
});
const cases = [
  ["01-home", "/?visualTest=1"],
  ["02-home-mid", "/?visualTest=1#featured-sequence-title"],
  ["03-discover", "/discover/?visualTest=1"],
  ["04-discover-filter", "/discover/?genre=pop&visualTest=1"],
  ["05-search", "/search/?visualTest=1"],
  ["06-search-result", "/search/?q=Radiohead&visualTest=1"],
  ["07-search-empty", "/search/?q=not-a-real-album-query&visualTest=1"],
  ["08-explore", "/explore/?visualTest=1"],
  ["09-for-you", "/for-you/?visualTest=1"],
  ["10-recent", "/new-releases/?visualTest=1"],
  ["11-library", "/library/?visualTest=1"],
  ["12-artists", "/artists/?visualTest=1"],
  ["13-artist-feature", "/artists/artist-6452/?visualTest=1"],
  ["14-artist-small", "/artists/artist-12127888/?visualTest=1"],
  ["15-album-rating", "/albums/ok-computer/?visualTest=1"],
  ["16-album-no-rating", "/albums/wake-after-the-rain/?visualTest=1"],
  ["17-album-long", "/albums/netease-1678569/?visualTest=1"],
  ["18-genres", "/genres/?visualTest=1"],
  ["19-core-topic", "/genres/core/pop/?visualTest=1"],
  ["20-related-topic", "/genres/related/ambient/?visualTest=1"],
  ["21-scenes", "/scenes/?visualTest=1"],
  ["22-scene-topic", "/scenes/night/?visualTest=1"],
  ["23-decades", "/decades/?visualTest=1"],
  ["24-decade-topic", "/decades/2000s/?visualTest=1"],
  ["25-settings", "/settings/?visualTest=1"],
  ["26-about", "/about/?visualTest=1"],
  ["27-not-found", "/albums/not-a-real-album/?visualTest=1"],
  ["28-library-want", "/library/?state=wantToListen&visualTest=1"],
  ["29-discover-page-2", "/discover/?page=2&visualTest=1"],
  ["30-search-artist", "/search/?q=周杰伦&visualTest=1"],
] as const;

async function expectNoOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
}

test.describe("full-site page acceptance matrix", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns the complete screenshot matrix.");
  for (const [name, route] of cases) {
    test(`${name} desktop and mobile`, async ({ page }) => {
      await mkdir(evidenceRoot, { recursive: true });
      const errors: string[] = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      for (const viewport of [{ width: 1440, height: 900, suffix: "desktop" }, { width: 390, height: 844, suffix: "mobile" }]) {
        await page.setViewportSize(viewport);
        const response = await page.goto(route);
        if (name === "27-not-found") expect(response?.status()).toBe(404);
        else if (response) expect(response.ok()).toBe(true);
        else await expect(page).toHaveURL(new RegExp(route.split("#", 1)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        await expect(page.locator("h1")).toHaveCount(1);
        await expectNoOverflow(page);
        await page.screenshot({ path: path.join(evidenceRoot, `${name}-${viewport.suffix}.png`), fullPage: true });
      }
      const actionableErrors = name === "27-not-found"
        ? errors.filter((message) => !message.includes("Failed to load resource"))
        : errors;
      expect(actionableErrors).toEqual([]);
    });
  }
});
