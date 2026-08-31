import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";
const evidenceDirectory = resolve(
  process.env.HOMEPAGE_FINAL_COMPOSITION_SCREENSHOT_DIR
    ?? ".local-data/homepage-final-composition-v1/screenshots",
);

function watchRuntime(page: Page) {
  const runtime = {
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    httpErrors: [] as string[],
    failedRequests: [] as string[],
    externalRequests: [] as string[],
  };
  page.on("console", (message) => { if (message.type() === "error") runtime.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => runtime.pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) runtime.httpErrors.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") runtime.failedRequests.push(request.url());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) runtime.externalRequests.push(url);
  });
  return runtime;
}

async function settle(page: Page) {
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
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

async function capture(page: Page, name: string, fullPage = false) {
  mkdirSync(evidenceDirectory, { recursive: true });
  await page.screenshot({
    path: join(evidenceDirectory, `${name}.png`),
    animations: "disabled",
    fullPage,
  });
}

async function scrollToSection(page: Page, selector: string, viewportFraction = 0) {
  await page.evaluate(({ targetSelector, fraction }) => {
    document.documentElement.style.scrollBehavior = "auto";
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (target) window.scrollTo(0, Math.max(0, target.offsetTop - window.innerHeight * fraction));
  }, { targetSelector: selector, fraction: viewportFraction });
  await page.waitForTimeout(250);
}

async function createPage(browser: Browser, viewport: { width: number; height: number }, mobile = false) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "dark",
    locale: "zh-CN",
    hasTouch: mobile,
    isMobile: mobile,
  });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  await settle(page);
  return { context, page, runtime };
}

test("final composition keeps one canonical selection flow in semantic order", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = watchRuntime(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await settle(page);

  const composition = await page.locator(
    ".ad-gallery, .ad-stage, .ad-chromatic, .r17-recent-return, .ad-continuation, .ad-ending",
  ).evaluateAll((nodes) => nodes.map((node) => node.classList[0]));
  expect(composition).toEqual([
    "ad-gallery",
    "ad-stage",
    "ad-chromatic",
    "r17-recent-return",
    "ad-continuation",
    "ad-ending",
  ]);
  await expect(page.locator(".ad-chromatic")).toHaveCount(1);
  await expect(page.locator(".ad-stage")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".ad-ambient-flow")).toBeVisible();

  await scrollToSection(page, ".ad-chromatic", .15);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "红", exact: true }).focus();
  await page.keyboard.press("Enter");
  const redAlbum = page.locator(".ad-chromatic__wall button").first();
  await redAlbum.focus();
  await page.keyboard.press("Enter");
  const selectedAlbumId = await page.locator(".ad-experience").getAttribute("data-selected-album");
  expect(selectedAlbumId).toBeTruthy();
  await expect(page.locator(".ad-marker")).toHaveAttribute("data-vinyl-label", selectedAlbumId!);
  await expect(page.locator(".ad-continuation")).toHaveAttribute("data-continuation-source", selectedAlbumId!);
  await expect(redAlbum).toHaveAttribute("aria-pressed", "true");
  expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore)).toBeLessThanOrEqual(2);

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector(".ad-stage")!.getBoundingClientRect();
    const chromatic = document.querySelector(".ad-chromatic")!.getBoundingClientRect();
    const heading = document.querySelector(".ad-chromatic h2")!.getBoundingClientRect();
    return {
      sectionGap: chromatic.top - stage.bottom,
      headingGap: heading.top - stage.bottom,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth <= 0).length,
    };
  });
  expect(Math.abs(geometry.sectionGap)).toBeLessThanOrEqual(1);
  expect(geometry.headingGap).toBeGreaterThanOrEqual(72);
  expect(geometry.headingGap).toBeLessThan(1080 * .35);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.brokenImages).toBe(0);
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
});

test("vinyl lifecycle releases before Chromatic Discovery and restores upward", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await settle(page);
  const fixed = page.locator(".ad-fixed");
  const vinyl = page.locator(".ad-marker");
  await expect(fixed).toHaveAttribute("data-marker-phase", "hero");

  await scrollToSection(page, ".ad-gallery", .2);
  await expect(fixed).toHaveAttribute("data-marker-phase", "dock");
  await expect(vinyl).toHaveAttribute("data-drag-enabled", "true");
  await page.waitForTimeout(500);
  let box = await vinyl.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(18 + box!.width / 2, box!.y + box!.height / 2, { steps: 10 });
  await page.mouse.up();
  box = await vinyl.boundingBox();
  expect(box!.x).toBeLessThanOrEqual(20);

  await scrollToSection(page, ".ad-chromatic", .2);
  await expect(fixed).toHaveAttribute("data-marker-phase", "release");
  await expect.poll(async () => Number(await page.locator(".ad-ambient-flow").getAttribute("data-flow-vinyl-energy"))).toBeLessThan(.02);
  await expect(vinyl).toHaveCSS("pointer-events", "none");

  await scrollToSection(page, ".ad-gallery", .2);
  await expect(fixed).toHaveAttribute("data-marker-phase", "dock");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(fixed).toHaveAttribute("data-marker-phase", "hero");
});

test("representative project-site routes remain static and runtime-clean", async ({ page, request }) => {
  test.setTimeout(180_000);
  const runtime = watchRuntime(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const route of [
    "/",
    "/discover/?visualTest=1",
    "/artists/?visualTest=1",
    "/albums/madvillainy/?visualTest=1",
    "/for-you/?visualTest=1",
    "/library/?visualTest=1",
    "/search/?q=Madvillainy&visualTest=1",
  ]) {
    const response = await page.goto(`${basePath}${route}`, { waitUntil: "load" });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    const geometry = await page.evaluate(async () => {
      const visibleImages = [...document.images].filter((image) => {
        const box = image.getBoundingClientRect();
        return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
      });
      await Promise.all(visibleImages.map((image) => Promise.race([
        image.decode().catch(() => undefined),
        new Promise<void>((done) => window.setTimeout(done, 2_000)),
      ])));
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        brokenImages: visibleImages.filter((image) => image.complete && image.naturalWidth <= 0).length,
      };
    });
    expect(geometry.overflow, route).toBeLessThanOrEqual(1);
    expect(geometry.brokenImages, route).toBe(0);
  }

  const notFound = await request.get(`${basePath}/this-route-does-not-exist/`);
  expect(notFound.status()).toBe(404);
  expect(await notFound.text()).toContain("未找到该档案");
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
});

test("captures the final composition review matrix", async ({ browser }) => {
  test.setTimeout(600_000);
  const evidence: unknown[] = [];

  for (const item of [
    { viewport: { width: 1920, height: 1080 }, names: ["01_stage", "02_stage_to_chromatic_transition", "03_chromatic_section"] },
    { viewport: { width: 1440, height: 900 }, names: ["04_stage_to_chromatic_transition", "05_chromatic_section"] },
    { viewport: { width: 768, height: 1024 }, names: ["06_stage_to_chromatic_transition", "07_chromatic_section"] },
    { viewport: { width: 390, height: 844 }, names: ["08_stage_to_chromatic_transition", "09_chromatic_section"], mobile: true },
  ]) {
    const { context, page, runtime } = await createPage(browser, item.viewport, item.mobile);
    if (item.names[0] === "01_stage") {
      await scrollToSection(page, ".ad-stage", -.25);
      await capture(page, item.names[0]);
      await scrollToSection(page, ".ad-chromatic", .45);
      await capture(page, item.names[1]);
      await scrollToSection(page, ".ad-chromatic");
      await capture(page, item.names[2]);
    } else {
      await scrollToSection(page, ".ad-chromatic", .45);
      await capture(page, item.names[0]);
      await scrollToSection(page, ".ad-chromatic");
      await capture(page, item.names[1]);
    }
    const state = await page.evaluate(() => {
      const stage = document.querySelector(".ad-stage")!.getBoundingClientRect();
      const chromatic = document.querySelector(".ad-chromatic")!.getBoundingClientRect();
      const heading = document.querySelector(".ad-chromatic h2")!.getBoundingClientRect();
      return {
        sectionGap: chromatic.top - stage.bottom,
        headingGap: heading.top - stage.bottom,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth <= 0).length,
      };
    });
    expect(Math.abs(state.sectionGap)).toBeLessThanOrEqual(1);
    expect(state.headingGap).toBeGreaterThanOrEqual(item.viewport.width <= 768 ? 64 : 84);
    expect(state.headingGap).toBeLessThan(item.viewport.height * .35);
    expect(state.overflow).toBeLessThanOrEqual(1);
    expect(state.brokenImages).toBe(0);
    expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
    evidence.push({ viewport: item.viewport, state, runtime });
    await context.close();
  }

  const { context, page, runtime } = await createPage(browser, { width: 1440, height: 900 });
  await capture(page, "10_full_homepage", true);
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
  await context.close();
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(join(evidenceDirectory, "HOMEPAGE_FINAL_COMPOSITION_V1_VISUAL_EVIDENCE.json"), `${JSON.stringify(evidence, null, 2)}\n`);
});
