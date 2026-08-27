import { expect, test, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";
const storageKey = "album-discovery:user-state:v1";
const state = {
  version: 1,
  taste: { genres: ["hip-hop", "jazz"], descriptors: [], contexts: ["night"], eras: ["2000s"], seedAlbumIds: ["album:18915"], exploration: "balanced" },
  likedAlbumIds: ["album:18915"],
  favoriteAlbumIds: ["album:18905"],
  savedAlbumIds: ["album:15190"],
  listenedAlbumIds: [],
  dismissedAlbumIds: [],
  recommendationFeedback: { "album:18915": "like" },
  recentAlbumIds: ["album:18915", "album:18905", "album:15190"],
  onboardingCompleted: true,
  updatedAt: "2026-08-27T00:00:00.000Z",
};

function watchRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(request.url()); });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, httpErrors, failedRequests, externalRequests };
}

async function settle(page: Page) {
  await page.waitForLoadState("load");
  const geometry = await page.evaluate(async () => {
    const visibleImages = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    });
    await Promise.all(visibleImages.map(async (image) => {
      if (!image.complete) await Promise.race([
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1_500)),
      ]);
      if (image.complete && image.naturalWidth > 0) {
        try { await Promise.race([image.decode(), new Promise<void>((resolve) => window.setTimeout(resolve, 1_000))]); } catch { /* dimensions below remain authoritative */ }
      }
    }));
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      brokenImages: visibleImages.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc),
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.brokenImages).toEqual([]);
}

test("public UX refinement journeys, responsive evidence and Pages runtime remain qualified", async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: state });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const runtime = watchRuntime(page);
  const cases = [
    { id: "home", route: "/", h1: "专辑发现" },
    { id: "explore", route: "/discover/", h1: "专辑目录" },
    { id: "decades", route: "/decades/", h1: "沿发行年代浏览" },
    { id: "recommendation", route: "/for-you/", h1: "下一张听什么" },
    { id: "library", route: "/library/", h1: "我的专辑" },
    { id: "madvillainy", route: "/albums/madvillainy/", h1: "Madvillainy" },
  ];

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const item of cases) {
      const response = await page.goto(`${basePath}${item.route}?visualTest=1`);
      expect(response?.status(), item.route).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: item.h1 })).toBeVisible();
      await settle(page);
      await page.screenshot({ path: testInfo.outputPath("screenshots", `${item.id}-${viewport.width}x${viewport.height}.png`), animations: "disabled" });
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${basePath}/?visualTest=1`);
  const marker = await page.locator(".ad-marker").boundingBox();
  expect(marker?.width).toBeGreaterThanOrEqual(180);
  expect(await page.locator(".ad-marker__grooves").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  await page.goto(`${basePath}/discover/?visualTest=1`);
  expect(await page.getByLabel("排序").locator("option").allTextContents()).toEqual(["最近收录", "发行时间：新→旧", "发行时间：旧→新", "随机发现"]);
  await page.getByLabel("排序").selectOption("random");
  await expect(page).toHaveURL(/sort=random/);
  await expect(page.locator(".album-card")).toHaveCount(48);

  await page.goto(`${basePath}/decades/?visualTest=1`);
  await expect(page.locator(".ux-decades__timeline > li")).toHaveCount(9);
  await expect(page.locator('.ux-decades__timeline a[href*="/discover/"][href*="decade="]').first()).toBeVisible();

  await page.goto(`${basePath}/for-you/?visualTest=1`);
  await expect(page.locator('.r14-for-you-journey [data-emphasis="primary"]')).toBeVisible();
  expect(await page.locator(".r14-for-you-journey .r14-personal-journey__support .r14-journey-card").count()).toBeGreaterThanOrEqual(3);

  await page.goto(`${basePath}/library/?visualTest=1`);
  await expect(page.locator("[data-library-ready=true]")).toBeVisible();
  await expect(page.locator("[data-library-album]").first()).toBeVisible();

  await page.goto(`${basePath}/albums/madvillainy/?visualTest=1`);
  const genreLink = page.locator('.signal-groups a[href*="/discover/"][href*="core="]').first();
  await expect(genreLink).toBeVisible();
  await genreLink.click();
  await expect(page).toHaveURL(/\/discover\/\?core=/);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Madvillainy" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1, name: "专辑目录" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${basePath}/discover/?visualTest=1`);
  const menu = page.getByRole("button", { name: "打开菜单" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await settle(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });

  expect((await request.get(`${basePath}/this-route-does-not-exist/`)).status()).toBe(404);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
});
