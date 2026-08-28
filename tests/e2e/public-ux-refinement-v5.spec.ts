import { expect, test, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";

function watchRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    const expected404 = page.url().includes("this-route-does-not-exist") && message.text().includes("404");
    if (message.type() === "error" && !expected404) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("this-route-does-not-exist")) httpErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(request.url());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, httpErrors, failedRequests, externalRequests };
}

async function settleAndAudit(page: Page) {
  await page.waitForLoadState("load");
  const result = await page.evaluate(async () => {
    const images = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    });
    await Promise.all(images.map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve) => {
        const done = () => resolve();
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        window.setTimeout(done, 1_500);
      });
      if (image.complete && image.naturalWidth) try { await image.decode(); } catch { /* dimensions remain authoritative */ }
    }));
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc),
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.broken).toEqual([]);
}

test("V5 closes the selected-record loop with disclosure, dock, continuation, and a composed detail hero", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const runtime = watchRuntime(page);
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    const suffix = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);

    await page.goto(`${basePath}/discover/?visualTest=1`);
    const disclosure = page.getByRole("button", { name: /更多筛选/ });
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("高级目录筛选")).toHaveCount(0);
    if (viewport.width === 1440 || viewport.width === 390) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `discover-collapsed-${suffix}.png`), animations: "disabled" });
    }
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("高级目录筛选")).toBeVisible();
    if (viewport.width === 1440 || viewport.width === 390) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `discover-expanded-${suffix}.png`), animations: "disabled" });
    }
    if (viewport.width === 1920) {
      await page.getByLabel("发行类型", { exact: true }).selectOption("album");
    } else {
      await page.goto(`${basePath}/discover/?type=album&visualTest=1`);
    }
    await expect(page).toHaveURL(/type=album/);
    await expect(page.getByRole("button", { name: /更多筛选 · 已启用 1 项/ })).toHaveAttribute("aria-expanded", "true");
    await settleAndAudit(page);
    if (viewport.width === 1440) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `discover-active-${suffix}.png`), animations: "disabled" });
    }

    await page.goto(`${basePath}/?visualTest=1`);
    const marker = page.locator(".ad-marker");
    const fixed = page.locator(".ad-fixed");
    const continuation = page.locator(".ad-continuation");
    await expect(marker).toHaveAttribute("data-vinyl-label", "madvillainy");
    await expect(page.getByRole("heading", { name: "从《Madvillainy》继续" })).toBeVisible();
    await expect(page.locator('audio, button[aria-label*="播放"], button[aria-label*="暂停"]')).toHaveCount(0);
    if (viewport.width === 1920) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `home-initial-${suffix}.png`), animations: "disabled" });
    }
    const nextAlbum = page.getByRole("button", { name: /选择《.+》作为黑胶标签/, pressed: false }).first();
    await nextAlbum.scrollIntoViewIfNeeded();
    await nextAlbum.click();
    await expect(marker).not.toHaveAttribute("data-vinyl-label", "madvillainy");
    await expect(continuation).not.toHaveAttribute("data-continuation-source", "madvillainy");
    await expect(page.getByRole("link", { name: /查看《.+》专辑详情/ })).toBeVisible();
    if (viewport.width === 1440 || viewport.width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("screenshots", `home-selected-${suffix}.png`), animations: "disabled" });
    }
    await page.evaluate(() => {
      const gallery = document.querySelector<HTMLElement>(".ad-gallery");
      if (gallery) window.scrollTo(0, Math.max(0, gallery.offsetTop - 200));
    });
    await expect(fixed).toHaveAttribute("data-marker-phase", "dock");
    await page.waitForTimeout(260);
    const dockSize = await marker.evaluate((node) => node.getBoundingClientRect().width);
    expect(dockSize).toBeGreaterThanOrEqual(viewport.width <= 768 ? 96 : 120);
    expect(dockSize).toBeLessThanOrEqual(viewport.width <= 768 ? 130 : 170);
    if (viewport.width === 1440) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `home-vinyl-dock-${suffix}.png`), animations: "disabled" });
    }
    await continuation.scrollIntoViewIfNeeded();
    await expect(fixed).toHaveAttribute("data-marker-phase", "release");
    await expect(continuation.locator("li")).toHaveCount(4);
    await expect(continuation.getByRole("link", { name: "进入推荐 ↗" })).toHaveAttribute("href", `${basePath}/for-you/`);
    await settleAndAudit(page);
    if (viewport.width === 1440 || viewport.width === 390) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `home-continuation-${suffix}.png`), animations: "disabled" });
    }

    await page.goto(`${basePath}/albums/madvillainy/?visualTest=1`);
    const context = page.locator(".album-detail__intro .ux-album-facts");
    await expect(context).toBeVisible();
    await expect(page.locator(".album-detail__content > .ux-album-facts")).toHaveCount(0);
    const rhythm = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(".album-detail__hero")!.getBoundingClientRect();
      const tracks = document.querySelector<HTMLElement>(".detail-card--tracks")!.getBoundingClientRect();
      return { gap: tracks.top - hero.bottom };
    });
    expect(rhythm.gap).toBeGreaterThanOrEqual(0);
    expect(rhythm.gap).toBeLessThan(100);
    await settleAndAudit(page);
    if (viewport.width === 1920 || viewport.width === 1440 || viewport.width === 390) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `detail-hero-${suffix}.png`), animations: "disabled" });
      await page.getByRole("heading", { name: "曲目表" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("screenshots", `detail-context-to-tracks-${suffix}.png`), animations: "disabled" });
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ["/artists/", "/search/?q=Madvillainy", "/for-you/", "/library/"]) {
    const response = await page.goto(`${basePath}${route}${route.includes("?") ? "&" : "?"}visualTest=1`);
    expect(response?.status()).toBe(200);
    await settleAndAudit(page);
  }
  const notFound = await page.goto(`${basePath}/this-route-does-not-exist/`);
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "未找到该档案" })).toBeVisible();

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
});
