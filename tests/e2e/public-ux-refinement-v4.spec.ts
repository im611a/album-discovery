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

test("V4 keeps detail rhythm content-driven, exposes discovery filters, and selects the homepage record", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
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

    await page.goto(`${basePath}/albums/madvillainy/?visualTest=1`);
    const context = page.getByRole("region", { name: "专辑分类与聆听信息" });
    await expect(context).toBeVisible();
    await expect(page.getByRole("heading", { name: "曲目表" })).toBeVisible();
    const contextBox = await context.boundingBox();
    expect(contextBox?.height ?? 9999).toBeLessThan(300);
    await page.evaluate(() => {
      const source = document.querySelector(".pa-album-file__source-entry");
      if (source) window.scrollTo(0, Math.max(0, source.getBoundingClientRect().top + scrollY - innerHeight * .55));
    });
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `detail-hero-context-${suffix}.png`), animations: "disabled" });
    await context.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("screenshots", `detail-context-tracks-${suffix}.png`), animations: "disabled" });

    await page.goto(`${basePath}/discover/?visualTest=1`);
    await expect(page.getByLabel("年代", { exact: true })).toBeVisible();
    await expect(page.getByLabel("核心流派", { exact: true })).toBeVisible();
    await expect(page.getByLabel("排序", { exact: true })).toBeVisible();
    await page.getByLabel("年代", { exact: true }).selectOption("2000s");
    await expect(page).toHaveURL(/decade=2000s/);
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `discover-primary-${suffix}.png`), animations: "disabled" });
    await page.locator(".catalog-advanced-filters summary").click();
    const relatedChoice = page.locator(".catalog-related-genres__choices button").nth(1);
    const relatedLabel = (await relatedChoice.textContent())?.trim() ?? "";
    await page.getByLabel("搜索相关流派").fill(relatedLabel);
    await relatedChoice.click();
    await expect(page).toHaveURL(/related=/);
    await expect(page.getByRole("button", { name: relatedLabel, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("排序", { exact: true }).selectOption("rym-rating-desc");
    await expect(page.getByText(/不将缺失值视为 0/)).toBeVisible();
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `discover-more-filters-${suffix}.png`), animations: "disabled" });

    await page.goto(`${basePath}/?visualTest=1`);
    const marker = page.locator(".ad-marker");
    await expect(marker).toHaveAttribute("data-vinyl-label", "madvillainy");
    await expect(page.locator('audio, button[aria-label*="播放"], button[aria-label*="暂停"]')).toHaveCount(0);
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `home-initial-${suffix}.png`), animations: "disabled" });
    const nextAlbum = page.getByRole("button", { name: /选择《.+》作为黑胶标签/, pressed: false }).first();
    const nextAlbumName = await nextAlbum.getAttribute("aria-label");
    expect(nextAlbumName).toBeTruthy();
    await nextAlbum.scrollIntoViewIfNeeded();
    await nextAlbum.click();
    await expect(page.getByRole("button", { name: nextAlbumName!, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(marker).not.toHaveAttribute("data-vinyl-label", "madvillainy");
    await expect(page.getByRole("link", { name: /查看《.+》专辑详情/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("screenshots", `home-selected-${suffix}.png`), animations: "disabled" });
    await page.evaluate(() => window.scrollTo(0, Math.round(innerHeight * .55)));
    await expect.poll(async () => Number(await page.locator("[data-homepage-production]").getAttribute("data-marker-progress"))).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `home-scrolled-${suffix}.png`), animations: "disabled" });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${basePath}/?visualTest=1`);
  const selection = page.getByRole("button", { name: /选择《.+》作为黑胶标签/, pressed: false }).first();
  const selectionName = await selection.getAttribute("aria-label");
  expect(selectionName).toBeTruthy();
  await selection.scrollIntoViewIfNeeded();
  await selection.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: selectionName!, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: /查看《.+》专辑详情/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

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
