import { expect, test, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";

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

async function assertNoOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    broken: [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      const visible = box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
      return visible && (!image.complete || image.naturalWidth <= 0);
    }).map((image) => image.currentSrc || image.src),
  }));
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.broken).toEqual([]);
}

async function captureSection(page: Page, selector: string, path: string) {
  const section = page.locator(selector);
  await section.evaluate((node) => window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - 72 }));
  await expect(section).toBeVisible();
  await section.locator("img").evaluateAll(async (nodes) => {
    const images = nodes as HTMLImageElement[];
    const visible = images.filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    await Promise.all(visible.map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 2_000);
      });
      try { await image.decode(); } catch { /* natural dimensions are asserted below */ }
    }));
  });
  await page.screenshot({ path, animations: "disabled" });
  await assertNoOverflow(page);
}

test("Album Discovery Experience V1 is continuous, explainable, chromatic, and static", async ({ page }, testInfo) => {
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
    await page.goto(`${basePath}/?visualTest=1`);
    await expect(page.locator(".ad-experience")).toHaveAttribute("data-selected-album", "madvillainy");
    await page.waitForLoadState("load");
    await page.evaluate(async () => { await document.fonts.ready; });
    await expect(page.locator(".ad-chromatic")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("screenshots", `home-overview-${suffix}.png`), animations: "disabled" });
    await captureSection(page, ".ad-chromatic", testInfo.outputPath("screenshots", `chromatic-default-${suffix}.png`));
    if (viewport.width === 390) {
      await page.getByRole("button", { name: "蓝", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".ad-chromatic")).toHaveAttribute("data-chromatic-tag", "blue");
      await captureSection(page, ".ad-chromatic", testInfo.outputPath("screenshots", "chromatic-keyboard-390x844.png"));
    }
    await captureSection(page, ".ad-continuation", testInfo.outputPath("screenshots", `continuation-after-chromatic-${suffix}.png`));
    await page.getByRole("button", { name: "关系视图 ↗" }).click();
    await expect(page.locator(".ad-relationship")).toBeVisible();
    const initialCenter = await page.locator(".ad-relationship").getAttribute("data-relationship-center");
    await captureSection(page, ".ad-relationship", testInfo.outputPath("screenshots", `relationship-initial-${suffix}.png`));
    const firstRelated = page.locator(".ad-relationship li button").first();
    await firstRelated.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ad-relationship")).not.toHaveAttribute("data-relationship-center", initialCenter ?? "");
    await expect(page.locator(".ad-relationship h3")).toBeFocused();
    await captureSection(page, ".ad-relationship", testInfo.outputPath("screenshots", `relationship-changed-${suffix}.png`));
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${basePath}/?visualTest=1`);
  await page.locator(".ad-gallery").scrollIntoViewIfNeeded();
  await page.locator(".ad-gallery button").nth(1).click();
  const atmosphereA = await page.locator(".ad-experience").evaluate((node) => getComputedStyle(node).getPropertyValue("--ad-accent").trim());
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-selected-atmosphere-a-1440x900.png"), animations: "disabled" });
  await page.locator(".ad-chromatic").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "红", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "chromatic-red-1440x900.png"), animations: "disabled" });
  await page.getByRole("button", { name: "蓝", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "chromatic-blue-1440x900.png"), animations: "disabled" });
  await page.getByRole("button", { name: "黑白", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "chromatic-mono-1440x900.png"), animations: "disabled" });
  await page.locator(".ad-chromatic__wall button").first().click();
  const atmosphereB = await page.locator(".ad-experience").evaluate((node) => getComputedStyle(node).getPropertyValue("--ad-accent").trim());
  expect(atmosphereB).not.toBe(atmosphereA);
  await page.screenshot({ path: testInfo.outputPath("screenshots", "chromatic-selected-atmosphere-b-1440x900.png"), animations: "disabled" });
  await page.locator(".ad-stage").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-vinyl-dock-1440x900.png"), animations: "disabled" });
  await page.locator(".r17-recent-return").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-lower-return-1440x900.png"), animations: "disabled" });
  await assertNoOverflow(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto(`${basePath}/?visualTest=1`);
  await page.locator(".ad-continuation").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "关系视图 ↗" }).click();
  await expect(page.locator(".ad-relationship__center")).toHaveCSS("animation-name", "none");
  await assertNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-200-percent-equivalent-reflow-720x450.png"), animations: "disabled" });

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
});
