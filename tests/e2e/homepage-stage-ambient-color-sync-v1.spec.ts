import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:4311";
const basePath = "/album-discovery";
const evidenceDirectory = resolve(
  process.env.STAGE_AMBIENT_SYNC_EVIDENCE_DIR
    ?? ".local-data/homepage-stage-ambient-color-sync-v1/after-fix",
);
const representativeStates = [
  { name: "warm", index: 3, progress: .6463157895 },
  { name: "cool", index: 2, progress: .4694736842 },
  { name: "pink", index: 0, progress: .1157894737 },
] as const;
const pixelSamples = [
  { name: "left-edge", x: 12, y: 240 },
  { name: "right-edge", x: 1896, y: 850 },
  { name: "bottom-edge", x: 1300, y: 1040 },
] as const;

function watchRuntime(page: Page) {
  const runtime = {
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    httpErrors: [] as string[],
    failedRequests: [] as string[],
    externalRequests: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error") runtime.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtime.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) runtime.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") runtime.failedRequests.push(request.url());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) {
      runtime.externalRequests.push(url);
    }
  });
  return runtime;
}

async function openHomepage(page: Page) {
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => Promise.race([
      image.decode().catch(() => undefined),
      new Promise<void>((done) => window.setTimeout(done, 2_000)),
    ])));
    document.documentElement.style.scrollBehavior = "auto";
  });
}

async function stageProgress(page: Page, progress: number) {
  await page.evaluate((nextProgress) => {
    const stage = document.querySelector<HTMLElement>(".ad-stage")!;
    const travel = Math.max(1, stage.offsetHeight - innerHeight);
    scrollTo(0, stage.offsetTop + travel * nextProgress);
  }, progress);
}

async function waitForStageAlbum(page: Page, index: number, settle = true) {
  await page.waitForFunction(
    (expected) => document.querySelector<HTMLElement>(".ad-stage__canvas")?.dataset.currentIndex === String(expected),
    index,
  );
  if (settle) await page.waitForTimeout(1_300);
}

async function stageIdentity(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".ad-stage")!;
    const flow = document.querySelector<HTMLElement>(".ad-stage__flow")!;
    const canvas = document.querySelector<HTMLElement>(".ad-stage__canvas")!;
    const title = document.querySelector<HTMLElement>(".ad-stage__title")!;
    const globalFlow = document.querySelector<HTMLElement>(".ad-ambient-flow")!;
    const style = getComputedStyle(stage);
    const normalizeColor = (value: string) => {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.append(probe);
      const normalized = getComputedStyle(probe).color;
      probe.remove();
      return normalized;
    };
    return {
      currentIndex: Number(canvas.dataset.currentIndex),
      titleAlbumId: title.dataset.albumId,
      stageAlbumId: stage.dataset.stageAmbientAlbumId,
      flowAlbumId: flow.dataset.stageAmbientAlbumId,
      canvasAlbumId: canvas.dataset.stageAmbientAlbumId,
      globalAlbumId: globalFlow.dataset.flowAlbumId,
      targetPrimary: normalizeColor(flow.dataset.stageFlowAccent ?? ""),
      targetSecondary: normalizeColor(flow.dataset.stageFlowAccentSecondary ?? ""),
      renderedPrimary: style.getPropertyValue("--ad-stage-flow-accent").trim(),
      renderedSecondary: style.getPropertyValue("--ad-stage-flow-accent-secondary").trim(),
      flowCount: document.querySelectorAll(".ad-stage__flow").length,
    };
  });
}

function channels(color: string) {
  const result = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!result || result.length !== 3) throw new Error(`Unable to parse color: ${color}`);
  return result;
}

function distance(left: string, right: string) {
  const a = channels(left);
  const b = channels(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function createPage(
  browser: Browser,
  viewport: { width: number; height: number },
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) {
  const mobile = viewport.width <= 390;
  const context = await browser.newContext({
    viewport,
    colorScheme: "dark",
    locale: "zh-CN",
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion,
  });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  await openHomepage(page);
  return { context, page, runtime };
}

test("camera-selected Stage album is the single Stage ambient identity authority", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(evidenceDirectory, { recursive: true });
  const runtime = watchRuntime(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHomepage(page);
  const flow = page.locator(".ad-stage__flow");
  await flow.evaluate((element) => element.setAttribute("data-continuity-sentinel", "preserved-node"));
  const globalAlbumId = await page.locator(".ad-ambient-flow").getAttribute("data-flow-album-id");
  const settled = [];

  for (const state of representativeStates) {
    await stageProgress(page, state.progress);
    await waitForStageAlbum(page, state.index);
    const identity = await stageIdentity(page);
    expect(identity.currentIndex).toBe(state.index);
    expect(new Set([
      identity.titleAlbumId,
      identity.stageAlbumId,
      identity.flowAlbumId,
      identity.canvasAlbumId,
    ]).size).toBe(1);
    expect(identity.globalAlbumId).toBe(globalAlbumId);
    expect(identity.renderedPrimary).toBe(identity.targetPrimary);
    expect(identity.renderedSecondary).toBe(identity.targetSecondary);
    expect(identity.flowCount).toBe(1);
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.pause()));
    const screenshotPath = join(evidenceDirectory, `${state.name}-settled.png`);
    await page.screenshot({ path: screenshotPath, animations: "allow" });
    const patches = [];
    for (const sample of pixelSamples) {
      const patchPath = join(evidenceDirectory, `${state.name}-${sample.name}-patch.png`);
      const enabled = await page.screenshot({
        path: patchPath,
        clip: { x: sample.x, y: sample.y, width: 12, height: 12 },
        animations: "allow",
      });
      await flow.evaluate((element: HTMLElement) => { element.style.display = "none"; });
      await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      const disabledPath = join(evidenceDirectory, `${state.name}-${sample.name}-flow-disabled.png`);
      const disabled = await page.screenshot({
        path: disabledPath,
        clip: { x: sample.x, y: sample.y, width: 12, height: 12 },
        animations: "allow",
      });
      await flow.evaluate((element: HTMLElement) => { element.style.display = ""; });
      await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      expect(enabled.equals(disabled), `${state.name}:${sample.name}`).toBe(false);
      patches.push({ ...sample, path: patchPath, disabledPath, renderedDelta: true });
    }
    settled.push({ state, identity, screenshotPath, patches });
  }

  await expect(flow).toHaveAttribute("data-continuity-sentinel", "preserved-node");
  expect(new Set(settled.map((record) => record.identity.targetPrimary)).size).toBe(3);
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
  writeFileSync(join(evidenceDirectory, "settled-stage-identity.json"), `${JSON.stringify({
    authority: "camera-selected-current-index",
    globalAlbumId,
    settled,
    runtime,
  }, null, 2)}\n`);
});

test("Stage ambient color morph retargets through rapid and reverse camera changes", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(evidenceDirectory, { recursive: true });
  const runtime = watchRuntime(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHomepage(page);
  await stageProgress(page, representativeStates[2].progress);
  await waitForStageAlbum(page, 0);
  const start = await stageIdentity(page);

  await stageProgress(page, representativeStates[0].progress);
  await waitForStageAlbum(page, 3, false);
  await page.waitForTimeout(220);
  const middle = await stageIdentity(page);
  expect(middle.currentIndex).toBe(3);
  expect(middle.titleAlbumId).toBe(middle.flowAlbumId);
  expect(distance(start.renderedPrimary, middle.renderedPrimary)).toBeGreaterThan(5);
  expect(distance(middle.renderedPrimary, middle.targetPrimary)).toBeGreaterThan(5);
  const midTransitionPath = join(evidenceDirectory, "stage-mid-transition.png");
  await page.screenshot({ path: midTransitionPath, animations: "allow" });

  for (const progress of [.8231578947, .2926315789, 1, .4694736842]) {
    await stageProgress(page, progress);
    await page.waitForTimeout(90);
  }
  await waitForStageAlbum(page, 2);
  const final = await stageIdentity(page);
  expect(final.currentIndex).toBe(2);
  expect(new Set([
    final.titleAlbumId,
    final.stageAlbumId,
    final.flowAlbumId,
    final.canvasAlbumId,
  ]).size).toBe(1);
  expect(final.renderedPrimary).toBe(final.targetPrimary);
  expect(final.flowCount).toBe(1);
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
  writeFileSync(join(evidenceDirectory, "transition-and-retarget.json"), `${JSON.stringify({
    start,
    middle,
    final,
    midTransitionPath,
    runtime,
  }, null, 2)}\n`);
});

test("Stage ambient identity remains synchronized across responsive and reduced-motion contexts", async ({ browser }) => {
  test.setTimeout(240_000);
  mkdirSync(evidenceDirectory, { recursive: true });
  const evidence = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    const { context, page, runtime } = await createPage(browser, viewport);
    await stageProgress(page, representativeStates[1].progress);
    await waitForStageAlbum(page, 2);
    const identity = await stageIdentity(page);
    expect(new Set([
      identity.titleAlbumId,
      identity.stageAlbumId,
      identity.flowAlbumId,
      identity.canvasAlbumId,
    ]).size).toBe(1);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth <= 0).length,
    }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.brokenImages).toBe(0);
    expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
    evidence.push({ viewport, identity, layout, runtime });
    await context.close();
  }

  const { context, page, runtime } = await createPage(
    browser,
    { width: 1440, height: 900 },
    "reduce",
  );
  await stageProgress(page, representativeStates[0].progress);
  await waitForStageAlbum(page, 3, false);
  const identity = await stageIdentity(page);
  expect(identity.renderedPrimary).toBe(identity.targetPrimary);
  await expect(page.locator(".ad-stage")).toHaveCSS("transition-duration", "0s");
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
  evidence.push({ viewport: { width: 1440, height: 900 }, reducedMotion: true, identity, runtime });
  await context.close();
  writeFileSync(join(evidenceDirectory, "responsive-reduced-motion.json"), `${JSON.stringify(evidence, null, 2)}\n`);
});
