import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const proofRoot = path.resolve(".local-data/v1.1-physical-archive/static-correction-proof/screens");
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };
const narrow = { width: 360, height: 800 };

const completedState = {
  version: 1,
  taste: {
    genres: ["hip-hop", "pop"],
    descriptors: [],
    contexts: ["night"],
    eras: ["2000s"],
    seedAlbumIds: ["album:287974232"],
    exploration: "balanced",
  },
  likedAlbumIds: ["album:287974232"],
  favoriteAlbumIds: [],
  savedAlbumIds: ["album:18915"],
  listenedAlbumIds: [],
  dismissedAlbumIds: [],
  recommendationFeedback: { "album:287974232": "like" },
  recentAlbumIds: [],
  onboardingCompleted: true,
  updatedAt: "2026-07-26T00:00:00.000Z",
};

async function prepare(page: Page, route: string, viewport = desktop, withState = false) {
  await mkdir(proofRoot, { recursive: true });
  await page.setViewportSize(viewport);
  if (withState) {
    await page.addInitScript((state) => {
      localStorage.setItem("album-discovery:user-state:v1", JSON.stringify(state));
    }, completedState);
  }
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) externalRequests.push(request.url());
  });
  await page.goto(route);
  await expect(page.locator("main h1")).toHaveCount(1);
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(document.documentElement.scrollWidth, 0);
    const horizontalScroll = window.scrollX;
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { selector: `${element.tagName.toLowerCase()}.${element.className}`, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      })
      .filter((item) => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 12);
    const scrollContainers = [...document.querySelectorAll<HTMLElement>("html, body, body *")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        selector: `${element.tagName.toLowerCase()}.${element.className}`,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      .slice(0, 12);
    return {
      hasOverflow: horizontalScroll > 1,
      horizontalScroll,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders,
      scrollContainers,
    };
  });
  expect(overflow.hasOverflow, JSON.stringify(overflow, null, 2)).toBe(false);
  expect(externalRequests).toEqual([]);
}

async function shot(page: Page, name: string, browserName: string, locator?: string) {
  const filename = browserName === "chromium" ? `${name}.png` : `${name}-${browserName}.png`;
  if (locator) {
    const target = page.locator(locator).first();
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeVisible();
    await target.screenshot({ path: path.join(proofRoot, filename) });
    return;
  }
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({
    path: path.join(proofRoot, filename),
    fullPage: browserName === "chromium" && pageHeight <= 32_000,
  });
}

const cases: Array<{
  batch: string;
  name: string;
  route: string;
  viewport?: typeof desktop;
  locator?: string;
  state?: boolean;
  action?: (page: Page) => Promise<void>;
}> = [
  { batch: "B01", name: "01-home-quiet-desktop", route: "/", locator: '[data-home-state="quiet"]' },
  { batch: "B01", name: "02-home-quiet-mobile", route: "/", viewport: mobile, locator: '[data-home-state="quiet"]' },
  { batch: "B01", name: "03-home-awakening-desktop", route: "/", locator: '[data-home-state="awakening"]' },
  { batch: "B01", name: "04-home-awakening-mobile", route: "/", viewport: mobile, locator: '[data-home-state="awakening"]' },
  { batch: "B01", name: "05-home-cabinet-desktop", route: "/", locator: '[data-home-state="cabinet"]' },

  { batch: "B02", name: "06-home-cabinet-mobile", route: "/", viewport: mobile, locator: '[data-home-state="cabinet"]' },
  { batch: "B02", name: "07-home-featured-01", route: "/", locator: ".pa-featured-scene:nth-child(1)" },
  { batch: "B02", name: "08-home-featured-02", route: "/", locator: ".pa-featured-scene:nth-child(2)" },
  { batch: "B02", name: "09-home-featured-03", route: "/", locator: ".pa-featured-scene:nth-child(3)" },
  { batch: "B02", name: "10-home-featured-mobile", route: "/", viewport: mobile, locator: ".pa-featured-scene:nth-child(1)" },

  { batch: "B03", name: "11-home-artists", route: "/", locator: ".pa-artist-archive" },
  { batch: "B03", name: "12-home-genres", route: "/", locator: ".pa-classification" },
  { batch: "B03", name: "13-home-decades", route: "/", locator: ".pa-decade-shelf" },
  { batch: "B03", name: "14-home-scenes", route: "/", locator: ".pa-scenes" },
  { batch: "B03", name: "15-home-personal", route: "/", locator: ".pa-personal-bench" },

  { batch: "B04", name: "16-home-footer", route: "/", locator: ".site-footer" },
  { batch: "B04", name: "17-discover-desktop", route: "/discover/" },
  { batch: "B04", name: "18-discover-expanded", route: "/discover/", action: async (page) => page.locator(".pa-filter-desk").evaluate((node) => { (node as HTMLDetailsElement).open = true; }) },
  { batch: "B04", name: "19-discover-mobile-drawer", route: "/discover/", viewport: mobile, action: async (page) => page.locator(".pa-filter-desk summary").click() },
  { batch: "B04", name: "20-search-default", route: "/search/" },

  { batch: "B05", name: "21-search-focus", route: "/search/", action: async (page) => page.getByLabel("搜索专辑目录").focus() },
  { batch: "B05", name: "22-search-results", route: "/search/?q=Radiohead" },
  { batch: "B05", name: "23-search-empty", route: "/search/?q=not-a-real-album-query" },
  { batch: "B05", name: "24-explore-desktop", route: "/explore/" },
  { batch: "B05", name: "25-explore-mobile", route: "/explore/", viewport: mobile },

  { batch: "B06", name: "26-for-you-onboarding", route: "/for-you/" },
  { batch: "B06", name: "27-for-you-candidates", route: "/for-you/", state: true },
  { batch: "B06", name: "28-taste-settings", route: "/settings/#taste" },
  { batch: "B06", name: "29-library-empty", route: "/library/" },
  { batch: "B06", name: "30-library-populated", route: "/library/", state: true },

  { batch: "B07", name: "31-recently-added", route: "/new-releases/" },
  { batch: "B07", name: "32-artists-desktop", route: "/artists/" },
  { batch: "B07", name: "33-artists-mobile", route: "/artists/", viewport: mobile },
  { batch: "B07", name: "34-album-detail-top", route: "/albums/wake-after-the-rain/", locator: ".album-detail__hero" },
  { batch: "B07", name: "35-album-detail-lower", route: "/albums/wake-after-the-rain/", locator: ".album-detail__content" },

  { batch: "B08", name: "36-artist-detail", route: "/artists/artist-6452/" },
  { batch: "B08", name: "37-genres-index", route: "/genres/" },
  { batch: "B08", name: "38-core-topic", route: "/genres/core/pop/" },
  { batch: "B08", name: "39-related-topic", route: "/genres/related/ambient/" },
  { batch: "B08", name: "40-decades-index", route: "/decades/" },

  { batch: "B09", name: "41-decade-topic", route: "/decades/2000s/" },
  { batch: "B09", name: "42-scenes-index", route: "/scenes/" },
  { batch: "B09", name: "43-scene-topic", route: "/scenes/night/" },
  { batch: "B09", name: "44-settings", route: "/settings/" },
  { batch: "B09", name: "45-about", route: "/about/" },

  { batch: "B10", name: "46-404", route: "/albums/not-a-real-album/" },
  { batch: "B10", name: "47-focus-visible", route: "/search/", action: async (page) => { await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); } },
  { batch: "B10", name: "48-local-state-menu", route: "/discover/", action: async (page) => page.locator(".album-actions--compact summary").first().click() },
  { batch: "B10", name: "49-mobile-menu", route: "/", viewport: mobile, action: async (page) => page.getByRole("button", { name: "打开菜单" }).click() },
  { batch: "B10", name: "50-discover-narrow", route: "/discover/", viewport: narrow },

  { batch: "B11", name: "51-search-narrow", route: "/search/?q=周杰伦", viewport: narrow },
  { batch: "B11", name: "52-for-you-mobile", route: "/for-you/", viewport: mobile, state: true },
  { batch: "B11", name: "53-album-mobile", route: "/albums/wake-after-the-rain/", viewport: mobile },
  { batch: "B11", name: "54-artist-mobile", route: "/artists/artist-6452/", viewport: mobile },
  { batch: "B11", name: "55-library-mobile", route: "/library/", viewport: mobile, state: true },
];

for (const item of cases) {
  test(`${item.batch} ${item.name}`, async ({ page, browserName }) => {
    await prepare(page, item.route, item.viewport ?? desktop, item.state);
    await item.action?.(page);
    await shot(page, item.name, browserName, item.locator);
  });
}

test("home quiet state contains no real album cover or album link", async ({ page }) => {
  await prepare(page, "/");
  const quiet = page.locator('[data-home-state="quiet"]');
  await expect(quiet.locator("[data-album-cover]")).toHaveCount(0);
  await expect(quiet.locator('a[href^="/albums/"]')).toHaveCount(0);
});

test("featured scenes expose previous active and next roles", async ({ page }) => {
  await prepare(page, "/");
  await expect(page.locator(".pa-featured-scene")).toHaveCount(3);
  for (const role of ["previous", "active", "next"]) {
    await expect(page.locator(`[data-featured-role="${role}"]`)).toHaveCount(3);
  }
});

test("B12 no JavaScript keeps core content and ordinary links", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: desktop });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("header a[href='/discover/']")).toBeVisible();
  await expect(page.locator("main a[href^='/albums/']").first()).toBeVisible();
  await context.close();
});

test("B12 reduced motion keeps every static home state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, "/");
  for (const state of ["quiet", "awakening", "cabinet"]) {
    await expect(page.locator(`[data-home-state="${state}"]`)).toBeVisible();
  }
  await expect(page.locator(".pa-featured-scene")).toHaveCount(3);
});
