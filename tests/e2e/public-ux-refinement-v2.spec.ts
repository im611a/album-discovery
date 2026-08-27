import { expect, test, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";
const storageKey = "album-discovery:user-state:v1";
const state = {
  version: 1,
  taste: { genres: ["hip-hop", "jazz"], descriptors: [], contexts: ["night"], eras: ["2000s"], seedAlbumIds: ["album:18915"], exploration: "balanced" },
  likedAlbumIds: ["album:18915"],
  favoriteAlbumIds: ["album:18905", "album:18915", "album:15190"],
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
  page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("this-route-does-not-exist")) httpErrors.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => { if (request.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(request.url()); });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, httpErrors, failedRequests, externalRequests };
}

async function settleAndAudit(page: Page) {
  await page.waitForLoadState("load");
  const result = await page.evaluate(async () => {
    const visible = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    });
    await Promise.all(visible.map(async (image) => {
      if (!image.complete) await Promise.race([
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1_500)),
      ]);
      if (image.complete && image.naturalWidth) try { await image.decode(); } catch { /* dimensions remain authoritative */ }
    }));
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: visible.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc),
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.broken).toEqual([]);
}

test("V2 product simplification remains clear, responsive and Pages-safe", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: state });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const runtime = watchRuntime(page);
  const cases = [
    { id: "home", route: "/", h1: "专辑发现" },
    { id: "for-you", route: "/for-you/", h1: "下一张听什么" },
    { id: "library", route: "/library/", h1: "我的专辑" },
    { id: "artists", route: "/artists/", h1: "艺人档案" },
    { id: "album-detail", route: "/albums/madvillainy/", h1: "Madvillainy" },
  ];

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const item of cases) {
      const response = await page.goto(`${basePath}${item.route}?visualTest=1`);
      expect(response?.status(), item.route).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: item.h1 })).toBeVisible();
      await settleAndAudit(page);
      await page.screenshot({ path: testInfo.outputPath("screenshots", `${item.id}-${viewport.width}x${viewport.height}.png`), animations: "disabled" });
    }
  }

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/for-you/", "/library/", "/artists/", "/albums/madvillainy/"]) {
      await page.goto(`${basePath}${route}?visualTest=1`);
      await settleAndAudit(page);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-marker__surface")).toBeVisible();
  await expect(page.locator('.primary-nav a[href$="/new-releases/"]')).toHaveCount(0);
  expect(await page.locator(".ad-marker__grooves").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  await page.goto(`${basePath}/discover/?sort=recently-added&visualTest=1`);
  await expect(page.getByRole("heading", { level: 1, name: "专辑目录" })).toBeVisible();
  await expect(page.getByLabel("排序")).toHaveValue("recently-added");

  await page.goto(`${basePath}/for-you/?visualTest=1`);
  await expect(page.locator('[data-for-you-card="primary"]')).toHaveCount(1);
  await expect(page.locator('[data-for-you-card="alternative"]')).toHaveCount(5);
  await expect(page.locator("#for-you-taste-settings")).toHaveCount(0);
  await page.getByRole("button", { name: "调整口味" }).click();
  await expect(page.locator("#for-you-taste-settings")).toBeVisible();

  await page.goto(`${basePath}/library/?visualTest=1`);
  const libraryTabs = page.getByRole("navigation", { name: "我的专辑分类" });
  await expect(libraryTabs.getByRole("link")).toHaveCount(2);
  await expect(libraryTabs.getByRole("link", { name: /收藏/ })).toBeVisible();
  await expect(libraryTabs.getByRole("link", { name: /最近查看/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "已收藏" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "已想听" })).toHaveCount(0);

  await page.goto(`${basePath}/artists/?visualTest=1`);
  const artistCategories = page.getByRole("navigation", { name: "按艺人名称文字系统缩小范围" });
  await expect(artistCategories.getByRole("link")).toHaveCount(6);
  await expect(page.getByLabel("排序")).toHaveValue("album-count");
  await expect(artistCategories).toContainText("不代表艺人的国家、地区、国籍或语言");

  await page.goto(`${basePath}/albums/madvillainy/?visualTest=1`);
  await expect(page.getByRole("heading", { level: 2, name: "分类与聆听" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "为什么值得完整听" })).toHaveCount(0);
  await expect(page.locator(".r12-related-works .pa-same-artist-shelf__record").first()).toBeVisible();
  await expect(page.locator(".r13-discovery")).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${basePath}/albums/madvillainy/?visualTest=1`);
    await page.locator(".r12-related-works").scrollIntoViewIfNeeded();
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `album-detail-same-artist-${viewport.width}x${viewport.height}.png`), animations: "disabled" });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${basePath}/artists/?visualTest=1`);
  const menu = page.getByRole("button", { name: "打开菜单" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();

  await page.goto(`${basePath}/library/?visualTest=1`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await settleAndAudit(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);

  const notFound = await page.goto(`${basePath}/this-route-does-not-exist/`);
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "未找到该档案" })).toBeVisible();
  await settleAndAudit(page);
});
