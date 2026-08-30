import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";
const screenshotDirectory = resolve(
  process.env.AMBIENT_V11_SCREENSHOT_DIR
    ?? ".local-data/homepage-ambient-flow-field-v1-1/visual-comparison/screenshots",
);

type RuntimeRecord = ReturnType<typeof watchRuntime>;

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

async function primeArtwork(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const initialY = window.scrollY;
    const step = Math.max(420, Math.floor(window.innerHeight * .85));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
    }
    window.scrollTo(0, initialY);
    await Promise.all([...document.images].map((image) => Promise.race([
      image.decode().catch(() => undefined),
      new Promise<void>((done) => window.setTimeout(done, 2_000)),
    ])));
  });
}

async function capture(page: Page, name: string) {
  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: join(screenshotDirectory, `${name}.png`), animations: "disabled" });
}

async function selectAlbum(page: Page, title: string) {
  const button = page.getByRole("button", { name: `选择《${title}》作为黑胶标签` });
  await expect(button).toHaveCount(1);
  await button.evaluate((element: HTMLButtonElement) => element.click());
  await page.waitForTimeout(1_200);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectHealthyGeometry(page: Page) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    broken: [...document.images]
      .filter((image) => image.complete && image.naturalWidth <= 0)
      .map((image) => image.currentSrc || image.src),
  }));
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.broken).toEqual([]);
}

function expectCleanRuntime(runtime: RuntimeRecord) {
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
}

async function openHomepage(page: Page) {
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
  await primeArtwork(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("V1.1 visual calibration comparison set", async ({ page }) => {
  test.setTimeout(600_000);
  const runtime = watchRuntime(page);
  const flow = page.locator(".ad-ambient-flow");
  const vinyl = page.locator(".ad-marker");

  await page.setViewportSize({ width: 1440, height: 900 });
  await openHomepage(page);
  await capture(page, "00_initial_1440x900");
  await expectHealthyGeometry(page);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHomepage(page);
  await expect(page.locator(".ad-experience")).toHaveAttribute("data-selected-album", "madvillainy");
  await capture(page, "01_initial_madvillainy");

  await selectAlbum(page, "Velocity: Design: Comfort.");
  await capture(page, "02_selected_blue");
  const blueAccent = await flow.getAttribute("data-flow-accent");

  await selectAlbum(page, "Loveless");
  await capture(page, "03_selected_red_or_purple");
  const purpleAccent = await flow.getAttribute("data-flow-accent");

  await selectAlbum(page, "Madvillainy");
  await capture(page, "04_selected_mono");
  const monoAccent = await flow.getAttribute("data-flow-accent");
  expect(new Set([blueAccent, purpleAccent, monoAccent]).size).toBe(3);

  await page.mouse.move(960, 540);
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-pointer-energy")), { timeout: 2_000 }).toBeLessThan(.08);
  await capture(page, "05_pointer_center");
  await page.mouse.move(3, 540);
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-pointer-energy"))).toBeGreaterThan(.7);
  await capture(page, "06_pointer_left");
  await page.mouse.move(1917, 540);
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-pointer-energy"))).toBeGreaterThan(.7);
  await capture(page, "07_pointer_right");

  await page.evaluate(() => {
    const gallery = document.querySelector<HTMLElement>(".ad-gallery");
    if (gallery) window.scrollTo(0, Math.max(0, gallery.offsetTop - 200));
  });
  await page.waitForTimeout(800);
  await expect(page.locator(".ad-fixed")).toHaveAttribute("data-marker-phase", "dock");
  await expect(vinyl).toHaveAttribute("data-drag-enabled", "true");
  await capture(page, "08_vinyl_dock_center");

  const centered = await vinyl.boundingBox();
  expect(centered).not.toBeNull();
  await page.mouse.move(centered!.x + centered!.width / 2, centered!.y + centered!.height / 2);
  await page.mouse.down();
  await page.mouse.move(18 + centered!.width / 2, centered!.y + centered!.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-vinyl-energy"))).toBeGreaterThan(.6);
  await capture(page, "09_vinyl_drag_left");

  const left = await vinyl.boundingBox();
  expect(left).not.toBeNull();
  await page.mouse.move(left!.x + left!.width / 2, left!.y + left!.height / 2);
  await page.mouse.down();
  await page.mouse.move(1920 - 18 - left!.width / 2, left!.y + left!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-vinyl-energy"))).toBeGreaterThan(.6);
  await capture(page, "10_vinyl_drag_right");

  await page.locator(".ad-continuation").scrollIntoViewIfNeeded();
  await expect(page.locator(".ad-fixed")).toHaveAttribute("data-marker-phase", "release");
  await expect.poll(async () => Number(await flow.getAttribute("data-flow-vinyl-energy")), { timeout: 2_500 }).toBeLessThan(.02);
  await capture(page, "11_release");
  await expectHealthyGeometry(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHomepage(page);
  await expect(page.locator(".ad-ambient-flow__ambient")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".ad-ambient-flow__rim")).toHaveCSS("animation-name", "none");
  await page.mouse.move(2, 400);
  await expect(flow).toHaveAttribute("data-flow-pointer-energy", "0.0000");
  await capture(page, "12_reduced_motion");
  await expectHealthyGeometry(page);
  expectCleanRuntime(runtime);
});

test("V1.1 390px field stays static and restrained", async ({ browser }) => {
  test.setTimeout(180_000);
  const context: BrowserContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: "dark",
    locale: "zh-CN",
  });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  await openHomepage(page);
  await expect(page.locator(".ad-marker")).toHaveAttribute("data-drag-enabled", "false");
  await expect(page.locator(".ad-ambient-flow__edge--left")).toHaveCSS("display", "none");
  await expect(page.locator(".ad-ambient-flow")).toHaveAttribute("data-flow-pointer-energy", "0.0000");
  await capture(page, "13_mobile_390");
  await expectHealthyGeometry(page);
  expectCleanRuntime(runtime);
  await context.close();
});
