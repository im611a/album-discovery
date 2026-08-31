import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";
const evidenceDirectory = resolve(
  process.env.HOMEPAGE_MOTION_POLISH_SCREENSHOT_DIR
    ?? ".local-data/homepage-motion-atmosphere-polish-v1/screenshots",
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

async function openHomepage(page: Page) {
  await page.goto(`${basePath}/?visualTest=1`);
  await expect(page.locator(".ad-home")).toHaveAttribute("data-runtime-state", "ready");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => Promise.race([
      image.decode().catch(() => undefined),
      new Promise<void>((done) => window.setTimeout(done, 2_000)),
    ])));
    window.scrollTo(0, 0);
  });
}

async function capture(page: Page, name: string) {
  mkdirSync(evidenceDirectory, { recursive: true });
  return page.screenshot({
    path: join(evidenceDirectory, `${name}.png`),
    animations: "allow",
  });
}

async function selectAlbum(page: Page, title: string) {
  const button = page.getByRole("button", { name: `选择《${title}》作为黑胶标签` });
  await expect(button).toHaveCount(1);
  await button.evaluate((element: HTMLButtonElement) => element.click());
}

async function stageProgress(page: Page, progress: number) {
  await page.evaluate((targetProgress) => {
    document.documentElement.style.scrollBehavior = "auto";
    const stage = document.querySelector<HTMLElement>(".ad-stage")!;
    const travel = Math.max(1, stage.offsetHeight - window.innerHeight);
    window.scrollTo(0, stage.offsetTop + travel * targetProgress);
  }, progress);
}

async function createPage(
  browser: Browser,
  viewport: { width: number; height: number },
  mobile = false,
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) {
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

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function rgbChannels(value: string) {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Expected an RGB color, received: ${value}`);
  return channels;
}

function colorDistance(left: string, right: string) {
  const a = rgbChannels(left);
  const b = rgbChannels(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function vinylState(page: Page) {
  return page.locator(".ad-stage__canvas").evaluate((canvas: HTMLElement) => {
    const ownerIndex = Number(canvas.dataset.vinylOwnerIndex);
    const groups = JSON.parse(canvas.dataset.stageGroups ?? "[]") as Array<{
      index: number;
      visibleVinylWidth: number;
    }>;
    return {
      target: Number(canvas.dataset.vinylEjectProgress),
      rendered: Number(canvas.dataset.vinylRenderedEjectProgress),
      visibleWidth: groups.find((group) => group.index === ownerIndex)?.visibleVinylWidth ?? 0,
    };
  });
}

test("global ambient palette remains painted throughout a canonical color transition", async ({ page }) => {
  test.setTimeout(180_000);
  const runtime = watchRuntime(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHomepage(page);
  const experience = page.locator(".ad-experience");
  const palette = page.locator(".ad-ambient-flow__palette");
  const samples = [{ x: 24, y: 520 }, { x: 1890, y: 650 }];
  const pixelEvidence: Record<string, unknown> = {};

  const oldAccent = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-accent").trim());
  const oldPaintAccent = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-flow-accent").trim());
  await capture(page, "01_global_t0_madvillainy");
  await selectAlbum(page, "Velocity: Design: Comfort.");
  await page.waitForTimeout(300);
  const midAccent = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-accent").trim());
  const midPaintAccent = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-flow-accent").trim());
  await capture(page, "02_global_tmid_madvillainy_to_velocity");
  const midPatches = await Promise.all(samples.map((sample) => page.screenshot({
    clip: { ...sample, width: 6, height: 6 },
    animations: "allow",
  })));

  await page.locator(".ad-ambient-flow").evaluate((element: HTMLElement) => { element.style.display = "none"; });
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await capture(page, "03_global_tmid_flow_disabled_control");
  const disabledPatches = await Promise.all(samples.map((sample) => page.screenshot({
    clip: { ...sample, width: 6, height: 6 },
    animations: "allow",
  })));
  await page.locator(".ad-ambient-flow").evaluate((element: HTMLElement) => { element.style.display = ""; });

  await page.waitForTimeout(1_000);
  const endAccent = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-accent").trim());
  const endPaintAccent = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-flow-accent").trim());
  await capture(page, "04_global_tend_velocity");

  expect(oldAccent).not.toBe(midAccent);
  expect(midAccent).not.toBe(endAccent);
  expect(oldPaintAccent).not.toBe(midPaintAccent);
  expect(midPaintAccent).not.toBe(endPaintAccent);
  expect(colorDistance(oldPaintAccent, midPaintAccent)).toBeGreaterThan(8);
  expect(colorDistance(midPaintAccent, endPaintAccent)).toBeGreaterThan(8);
  expect(await palette.count()).toBe(1);
  for (const [index, sample] of samples.entries()) {
    expect(midPatches[index].equals(disabledPatches[index]), JSON.stringify(sample)).toBe(false);
    pixelEvidence[`sample${index + 1}`] = {
      coordinate: sample,
      midPatchSha256: sha256(midPatches[index]),
      disabledPatchSha256: sha256(disabledPatches[index]),
      renderedDelta: true,
    };
  }

  const buttons = page.locator(".ad-gallery button");
  await palette.evaluate((element) => element.setAttribute("data-continuity-sentinel", "preserved-node"));
  let renderedPaint = endPaintAccent;
  for (const index of [1, 2, 3, 4]) {
    await buttons.nth(index).evaluate((element: HTMLButtonElement) => element.click());
    const retargetStart = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-flow-accent").trim());
    expect(colorDistance(renderedPaint, retargetStart)).toBeLessThan(18);
    await page.waitForTimeout(70);
    renderedPaint = await experience.evaluate((element) => getComputedStyle(element).getPropertyValue("--ad-flow-accent").trim());
  }
  const latestAlbumId = await buttons.nth(4).evaluate((element) => element.closest("[data-album-id]")?.getAttribute("data-album-id"));
  await expect(page.locator(".ad-ambient-flow")).toHaveAttribute("data-flow-album-id", latestAlbumId!);
  await expect(palette).toHaveAttribute("data-continuity-sentinel", "preserved-node");
  await page.waitForTimeout(1_000);
  await capture(page, "05_global_rapid_selection_latest_wins");

  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(join(evidenceDirectory, "AMBIENT_RENDERED_CONTINUITY.json"), `${JSON.stringify({
    transitionMs: 1200,
    oldAccent,
    midAccent,
    endAccent,
    oldPaintAccent,
    midPaintAccent,
    endPaintAccent,
    samples: pixelEvidence,
    paletteCount: await palette.count(),
    latestAlbumId,
    runtime,
  }, null, 2)}\n`);
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
});

test("Stage flow follows the camera-active album and the Stage vinyl has weighted interruptible travel", async ({ page }) => {
  test.setTimeout(240_000);
  const runtime = watchRuntime(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openHomepage(page);
  const flow = page.locator(".ad-stage__flow");
  const canvas = page.locator(".ad-stage__canvas");
  await expect(flow).toHaveCount(1);
  await expect(flow).toHaveAttribute("data-stage-flow", "camera-active-album");
  await expect(flow).toHaveCSS("pointer-events", "none");
  expect(Number(await flow.evaluate((element) => getComputedStyle(element).zIndex))).toBeLessThan(
    Number(await canvas.evaluate((element) => getComputedStyle(element).zIndex)),
  );

  await stageProgress(page, 0);
  await page.waitForTimeout(900);
  await capture(page, "06_stage_vinyl_retracted");
  const retracted = await vinylState(page);
  await page.mouse.move(960, 540);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(100);
  const earlyEmerge = await vinylState(page);
  expect(earlyEmerge.target).toBeGreaterThan(.75);
  expect(earlyEmerge.target).toBeLessThan(.88);
  expect(earlyEmerge.rendered).toBeGreaterThan(retracted.rendered);
  expect(earlyEmerge.rendered).toBeLessThan(.16);
  await page.waitForTimeout(200);
  const midEmerge = await vinylState(page);
  expect(midEmerge.rendered).toBeGreaterThan(earlyEmerge.rendered);
  expect(midEmerge.rendered).toBeLessThan(.56);
  expect(midEmerge.visibleWidth).toBeGreaterThanOrEqual(earlyEmerge.visibleWidth);
  await capture(page, "07_stage_vinyl_mid_emerge");
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(1_000);
  const emerged = await vinylState(page);
  expect(emerged.target).toBe(1);
  expect(emerged.rendered).toBeGreaterThan(.94);
  expect(emerged.visibleWidth).toBeGreaterThan(midEmerge.visibleWidth);
  await capture(page, "08_stage_vinyl_emerged");

  await page.mouse.wheel(0, -320);
  await page.waitForTimeout(100);
  const earlyRetract = await vinylState(page);
  expect(earlyRetract.target).toBeLessThan(.01);
  expect(earlyRetract.rendered).toBeGreaterThan(.8);
  await page.waitForTimeout(200);
  const midRetract = await vinylState(page);
  expect(midRetract.rendered).toBeGreaterThan(.35);
  expect(midRetract.rendered).toBeLessThan(.56);
  expect(midRetract.visibleWidth).toBeLessThan(earlyRetract.visibleWidth);
  await capture(page, "09_stage_vinyl_mid_retract");
  const beforeRetarget = await vinylState(page);
  await page.mouse.wheel(0, 320);
  await page.waitForTimeout(100);
  const retargeted = await vinylState(page);
  expect(retargeted.target).toBe(1);
  expect(retargeted.rendered).toBeGreaterThan(beforeRetarget.rendered);

  for (const [progress, index, name] of [
    [.6463157895, 3, "10_stage_flow_warm"],
    [.4694736842, 2, "11_stage_flow_cool"],
    [.1157894737, 0, "12_stage_flow_pink"],
  ] as const) {
    await stageProgress(page, progress);
    await page.waitForFunction(
      (expected) => document.querySelector<HTMLElement>(".ad-stage__canvas")?.dataset.currentIndex === String(expected),
      index,
    );
    await page.waitForTimeout(1_300);
    const identities = await page.evaluate(() => ({
      title: document.querySelector<HTMLElement>(".ad-stage__title")?.dataset.albumId,
      flow: document.querySelector<HTMLElement>(".ad-stage__flow")?.dataset.stageAmbientAlbumId,
      canvas: document.querySelector<HTMLElement>(".ad-stage__canvas")?.dataset.stageAmbientAlbumId,
      stage: document.querySelector<HTMLElement>(".ad-stage")?.dataset.stageAmbientAlbumId,
    }));
    expect(new Set(Object.values(identities)).size).toBe(1);
    await capture(page, name);
  }

  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth <= 0).length,
    stageFlowAnimation: getComputedStyle(document.querySelector(".ad-stage__flow")!).animationName,
  }));
  expect(state.overflow).toBeLessThanOrEqual(1);
  expect(state.brokenImages).toBe(0);
  expect(state.stageFlowAnimation).toBe("ad-stage-flow-drift");
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
});

test("responsive and reduced-motion Stage qualification remains restrained", async ({ browser }) => {
  test.setTimeout(360_000);
  const evidence = [];
  for (const item of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844, mobile: true },
  ]) {
    const { context, page, runtime } = await createPage(browser, item, item.mobile);
    await stageProgress(page, .12);
    await page.waitForTimeout(900);
    await capture(page, `13_stage_responsive_${item.width}x${item.height}`);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth <= 0).length,
      flowOpacity: Number(getComputedStyle(document.querySelector(".ad-stage__flow")!).opacity),
    }));
    expect(state.overflow).toBeLessThanOrEqual(1);
    expect(state.brokenImages).toBe(0);
    expect(state.flowOpacity).toBeLessThanOrEqual(item.width <= 768 ? .38 : .58);
    expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
    evidence.push({ viewport: item, state, runtime });
    await context.close();
  }

  const { context, page, runtime } = await createPage(
    browser,
    { width: 1440, height: 900 },
    false,
    "reduce",
  );
  await stageProgress(page, .12);
  await page.waitForTimeout(50);
  await expect(page.locator(".ad-stage__flow")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".ad-experience")).toHaveCSS("transition-duration", "0s");
  await expect(page.locator(".ad-stage")).toHaveCSS("transition-duration", "0s");
  const canvas = page.locator(".ad-stage__canvas");
  expect(Math.abs(
    Number(await canvas.getAttribute("data-vinyl-rendered-eject-progress"))
      - Number(await canvas.getAttribute("data-vinyl-eject-progress")),
  )).toBeLessThan(.002);
  await capture(page, "14_stage_reduced_motion");
  expect(runtime).toEqual({ consoleErrors: [], pageErrors: [], httpErrors: [], failedRequests: [], externalRequests: [] });
  await context.close();
  writeFileSync(join(evidenceDirectory, "RESPONSIVE_RUNTIME_EVIDENCE.json"), `${JSON.stringify(evidence, null, 2)}\n`);
});
