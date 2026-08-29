import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

async function settleArtwork(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const initialY = window.scrollY;
    const step = Math.max(420, Math.floor(window.innerHeight * 0.85));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    window.scrollTo(0, initialY);
    await Promise.all([...document.images].map(async (image) => {
      await Promise.race([
        image.decode().catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
      ]);
    }));
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await settleArtwork(page);
  await page.screenshot({ path: testInfo.outputPath("screenshots", name), animations: "disabled" });
}

async function expectHealthyGeometry(page: Page) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    broken: [...document.images].filter((image) => image.complete && image.naturalWidth <= 0).map((image) => image.currentSrc || image.src),
  }));
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.broken).toEqual([]);
}

test("ambient field follows the one selected-record authority and the existing runtime", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const runtime = watchRuntime(page);
  const flow = page.locator(".ad-ambient-flow");

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${basePath}/?visualTest=1`);
    await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
    await expect(flow).toHaveAttribute("aria-hidden", "true");
    await expect(flow).toHaveCSS("pointer-events", "none");
    await expect(page.locator(".ad-experience")).toHaveAttribute("data-selected-album", "madvillainy");
    await capture(page, testInfo, `01-initial-${viewport.width}x${viewport.height}.png`);
    await expectHealthyGeometry(page);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
  const experience = page.locator(".ad-experience");
  const vinyl = page.locator(".ad-marker");
  const continuation = page.locator(".ad-continuation");
  const initialAccent = await flow.getAttribute("data-flow-accent");
  const secondPoster = page.locator(".ad-poster").nth(1);
  const secondAlbumId = await secondPoster.getAttribute("data-album-id");
  await secondPoster.locator("button").click();
  const selectedSlug = await experience.getAttribute("data-selected-album");
  await expect(vinyl).toHaveAttribute("data-vinyl-label", selectedSlug ?? "");
  await expect(continuation).toHaveAttribute("data-continuation-source", selectedSlug ?? "");
  await expect(flow).not.toHaveAttribute("data-flow-accent", initialAccent ?? "");
  await capture(page, testInfo, "02-selected-another-album-1920x1080.png");
  await page.waitForTimeout(1_300);
  await capture(page, testInfo, "03-flow-accent-settled-1920x1080.png");
  await continuation.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "关系视图 ↗" }).click();
  await expect(page.locator(".ad-relationship")).toHaveAttribute("data-relationship-center", secondAlbumId ?? "");

  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
  await page.mouse.move(3, 540);
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-pointer-energy"))).toBeGreaterThan(0.55);
  await capture(page, testInfo, "04-pointer-left-edge-1920x1080.png");
  await page.mouse.move(1917, 540);
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-pointer-energy"))).toBeGreaterThan(0.55);
  await capture(page, testInfo, "05-pointer-right-edge-1920x1080.png");
  await page.locator(".ad-home").dispatchEvent("pointerleave");
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-pointer-energy")), { timeout: 2_000 }).toBeLessThan(0.08);

  await page.evaluate(() => {
    const gallery = document.querySelector<HTMLElement>(".ad-gallery");
    if (gallery) window.scrollTo(0, Math.max(0, gallery.offsetTop - 200));
  });
  await expect(page.locator(".ad-fixed")).toHaveAttribute("data-marker-phase", "dock");
  await capture(page, testInfo, "06-vinyl-dock-centered-1920x1080.png");
  const centered = await vinyl.boundingBox();
  expect(centered).not.toBeNull();
  await page.mouse.move(centered!.x + centered!.width / 2, centered!.y + centered!.height / 2);
  await page.mouse.down();
  await page.mouse.move(18 + centered!.width / 2, centered!.y + centered!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-vinyl-energy"))).toBeGreaterThan(0.6);
  await capture(page, testInfo, "07-vinyl-dragged-left-1920x1080.png");
  const left = await vinyl.boundingBox();
  expect(left).not.toBeNull();
  await page.mouse.move(left!.x + left!.width / 2, left!.y + left!.height / 2);
  await page.mouse.down();
  await page.mouse.move(1920 - 18 - left!.width / 2, left!.y + left!.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-vinyl-energy"))).toBeGreaterThan(0.6);
  await capture(page, testInfo, "08-vinyl-dragged-right-1920x1080.png");
  await continuation.scrollIntoViewIfNeeded();
  await expect(page.locator(".ad-fixed")).toHaveAttribute("data-marker-phase", "release");
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-vinyl-energy")), { timeout: 2_500 }).toBeLessThan(0.02);
  await capture(page, testInfo, "09-vinyl-release-1920x1080.png");
  await page.locator(".ad-stage").scrollIntoViewIfNeeded();
  await capture(page, testInfo, "10-album-field-end-1920x1080.png");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-ambient-flow__ambient")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".ad-ambient-flow__rim")).toHaveCSS("animation-name", "none");
  await page.mouse.move(2, 400);
  await expect(flow).toHaveAttribute("data-flow-pointer-energy", "0.0000");
  await capture(page, testInfo, "11-reduced-motion-static-1920x1080.png");
  await expectHealthyGeometry(page);

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
});

test("390px coarse-pointer field remains static, non-interactive, and overflow-safe", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: "dark",
    locale: "zh-CN",
  });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
  await expect(page.locator(".ad-marker")).toHaveAttribute("data-drag-enabled", "false");
  await expect(page.locator(".ad-ambient-flow__edge--left")).toHaveCSS("display", "none");
  await expect(page.locator(".ad-ambient-flow")).toHaveAttribute("data-flow-pointer-energy", "0.0000");
  await capture(page, testInfo, "12-mobile-coarse-390x844.png");
  await expectHealthyGeometry(page);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
  await context.close();
});
