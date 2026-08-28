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
    const expectedNotFoundResource = page.url().includes("this-route-does-not-exist")
      && message.text().includes("Failed to load resource")
      && message.text().includes("404");
    if (message.type() === "error" && !expectedNotFoundResource) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("this-route-does-not-exist")) {
      httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(request.url());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) {
      externalRequests.push(url);
    }
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
    const verticalSingles = [...document.querySelectorAll<HTMLElement>("h1, h2, h3, a, button, label")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return element.innerText.trim().length > 1 && rect.width > 0 && rect.width < 24 && rect.height > rect.width * 4 && style.writingMode === "horizontal-tb";
    }).map((element) => element.innerText.trim());
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: visible.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc),
      verticalSingles,
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.broken).toEqual([]);
  expect(result.verticalSingles).toEqual([]);
}

test("V3 simplifies taxonomy and search without weakening the static product", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const runtime = watchRuntime(page);
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    await page.goto(`${basePath}/?visualTest=1`);
    await expect(page.getByRole("heading", { level: 1, name: "专辑发现" })).toBeVisible();
    await expect(page.locator('[data-vinyl-label="madvillainy"][data-audio-source="required"]')).toBeVisible();
    await expect(page.locator('[data-vinyl-label="madvillainy"] .ad-marker__label img')).toHaveAttribute("src", /316551\.webp/);
    await expect(page.locator('audio, video, button[aria-label*="播放"], button[aria-label*="暂停"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/decades"]')).toHaveCount(0);
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `home-${viewport.width}x${viewport.height}.png`), animations: "disabled" });

    await page.goto(`${basePath}/discover/?sort=rym-rating-desc&decade=2000s&rym=rated&visualTest=1`);
    await expect(page.getByRole("heading", { level: 1, name: "专辑目录" })).toBeVisible();
    await expect(page.getByLabel("排序")).toHaveValue("rym-rating-desc");
    await page.locator(".catalog-advanced-filters summary").click();
    await expect(page.getByLabel("年代")).toHaveValue("2000s");
    await expect(page.getByText(/不将缺失值视为 0/)).toBeVisible();
    await expect(page.getByText(/仅看有 RYM 评分/)).toBeVisible();
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `discover-${viewport.width}x${viewport.height}.png`), animations: "disabled" });

    await page.goto(`${basePath}/artists/?visualTest=1`);
    await expect(page.getByRole("heading", { level: 1, name: "艺人档案" })).toBeVisible();
    const genres = page.getByRole("navigation", { name: "按艺人主流派缩小范围" });
    await expect(genres.getByRole("link")).toHaveCount(10);
    await expect(genres).toContainText("不使用姓名或地区推断");
    await expect(page.getByLabel("排序")).toHaveValue("album-count");
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `artists-${viewport.width}x${viewport.height}.png`), animations: "disabled" });

    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: "搜索专辑与艺人" });
    await expect(dialog).toBeVisible();
    const input = page.getByRole("searchbox", { name: "全局搜索" });
    await expect(input).toBeFocused();
    await input.fill("Madvillainy");
    await expect(dialog.locator("#global-search-albums")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Madvillainy/ }).first()).toBeVisible();
    await settleAndAudit(page);
    await page.screenshot({ path: testInfo.outputPath("screenshots", `search-overlay-${viewport.width}x${viewport.height}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${basePath}/?visualTest=1`);
  const searchTrigger = page.getByRole("button", { name: "搜索" }).first();
  await searchTrigger.focus();
  await searchTrigger.click();
  await expect(page.getByRole("searchbox", { name: "全局搜索" })).toBeFocused();
  await page.getByRole("searchbox", { name: "全局搜索" }).fill("Madvillainy");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Escape");
  await expect(searchTrigger).toBeFocused();

  for (const item of [
    { route: "/albums/madvillainy/", heading: "Madvillainy" },
    { route: "/for-you/", heading: "下一张听什么" },
    { route: "/library/", heading: "我的专辑" },
  ]) {
    const response = await page.goto(`${basePath}${item.route}?visualTest=1`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: item.heading })).toBeVisible();
    await settleAndAudit(page);
  }

  await page.goto(`${basePath}/decades/2000s/?visualTest=1`);
  await expect(page.getByRole("link", { name: /查看 2000 年代\s+专辑/ })).toHaveAttribute("href", "/album-discovery/discover/?decade=2000s");

  await page.goto(`${basePath}/search/?q=Madvillainy&visualTest=1`);
  await expect(page.getByRole("dialog", { name: "搜索专辑与艺人" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "全局搜索" })).toHaveValue("Madvillainy");
  await page.keyboard.press("Escape");

  const notFound = await page.goto(`${basePath}/this-route-does-not-exist/`);
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "未找到该档案" })).toBeVisible();
  await settleAndAudit(page);

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
});

test("V3 keeps the homepage vinyl pointer response and scroll recession", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${basePath}/?visualTest=1`);
  const root = page.locator("[data-homepage-production]");
  const marker = page.locator('[data-vinyl-label="madvillainy"]');
  await expect(root).toHaveAttribute("data-runtime-state", "ready");
  const box = await marker.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * .82, box!.y + box!.height * .52);
  await expect.poll(() => marker.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-vinyl-tilt-y"))).not.toBe("0.00deg");

  const before = Number(await root.getAttribute("data-marker-progress"));
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(async () => Number(await root.getAttribute("data-marker-progress"))).toBeGreaterThan(before);
  await expect.poll(() => marker.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue("--ad-marker-scale")))).toBeLessThan(1);
});
