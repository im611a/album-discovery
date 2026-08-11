import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const evidenceRoot = path.resolve(
  ".local-data/r13-product-evolution/r13-3d-visible-activation",
);
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const forbiddenRuntimeHost = /musicbrainz|coverartarchive|music\.163|rateyourmusic|spotify|apple|last\.fm|discogs/i;

const reviewCases = [
  { name: "artist-multi-dense", route: "/artists/artist-1132392/", heading: "从作品年表继续" },
  { name: "artist-multi-two", route: "/artists/artist-12084497/", heading: "从作品年表继续" },
  { name: "artist-single", route: "/artists/artist-12127888/", heading: "从唯一作品向外继续" },
  { name: "artist-single-alternate", route: "/artists/artist-12453904/", heading: "从唯一作品向外继续" },
  { name: "topic-primary", route: "/genres/core/alternative-rock/", heading: "从这一专题继续" },
  { name: "topic-secondary", route: "/genres/related/2-step/", heading: "从这一专题继续" },
  { name: "topic-era", route: "/decades/1950s/", heading: "从这一专题继续" },
  { name: "topic-context", route: "/scenes/commute/", heading: "从这一专题继续" },
] as const;

function watchRuntime(page: Page) {
  const state = {
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    httpErrors: [] as string[],
    serverErrors: [] as string[],
    externalRequests: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
    if (response.status() >= 500) state.serverErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (forbiddenRuntimeHost.test(request.url())
      || (/^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4311")) {
      state.externalRequests.push(request.url());
    }
  });
  return state;
}

function expectRuntimeClean(runtime: ReturnType<typeof watchRuntime>) {
  expect(runtime.externalRequests).toEqual([]);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.serverErrors).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const measurement = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
  expect(measurement.scrollWidth, JSON.stringify(measurement)).toBeLessThanOrEqual(measurement.clientWidth + 1);
  return measurement;
}

async function waitForCovers(discovery: Locator) {
  await discovery.scrollIntoViewIfNeeded();
  await expect(discovery.locator(".album-cover").first()).toBeVisible();
  const images = discovery.locator("img.album-cover");
  if (await images.count()) {
    await expect.poll(() => images.evaluateAll((items) => items.every((item) => {
      const image = item as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    }))).toBe(true);
  }
}

async function auditEntitySurface(page: Page, expectedHeading: string) {
  const discovery = page.locator(".r13-entity-discovery");
  await expect(discovery).toHaveCount(1);
  await expect(discovery.getByRole("heading", { level: 2, name: expectedHeading })).toBeVisible();
  const primary = discovery.locator(".r13-entity-discovery__primary");
  const alternates = discovery.locator(".r13-entity-discovery__alternates li > a");
  await expect(primary).toHaveCount(1);
  expect(await alternates.count()).toBeLessThanOrEqual(3);
  await expect(discovery).not.toContainText(/PRIMARY_GENRE|SECONDARY_GENRE|candidatePool|rankKey|相似度|匹配度|AI 推荐|猜你喜欢|热门选择|\d+%/iu);
  const hrefs = await discovery.locator(".r13-entity-discovery__primary, .r13-entity-discovery__alternates li > a")
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(hrefs.every((href) => new URL(href).pathname.startsWith("/albums/"))).toBe(true);
  await waitForCovers(discovery);
  for (const link of await discovery.getByRole("link").all()) {
    await expect(link).toHaveAccessibleName(/\S/);
  }
  await primary.focus();
  await expect(primary).toBeFocused();
  const focus = await primary.evaluate((element) => ({
    style: getComputedStyle(element).outlineStyle,
    width: Number.parseFloat(getComputedStyle(element).outlineWidth),
  }));
  expect(focus.style).not.toBe("none");
  expect(focus.width).toBeGreaterThanOrEqual(2);
  const coverRatios = await discovery.locator(".album-cover").evaluateAll((covers) => covers.map((cover) => {
    const box = cover.getBoundingClientRect();
    return Math.abs(box.width - box.height);
  }));
  expect(coverRatios.every((difference) => difference <= 2)).toBe(true);
  return { primaryHref: await primary.getAttribute("href"), alternateCount: await alternates.count() };
}

test.describe("R13-3D visible Artist and Topic continuous discovery", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns R13-3D evidence.");

  test("preserves every representative archive and records human-review evidence", async ({ page }) => {
    test.setTimeout(120_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime = watchRuntime(page);
    const results: Record<string, unknown> = {};
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const item of reviewCases) {
      await page.goto(item.route);
      const metrics = await auditEntitySurface(page, item.heading);
      const archiveSelector = item.name.startsWith("artist") ? ".r12-discography" : ".album-grid";
      const archive = page.locator(archiveSelector).first();
      await expect(archive).toBeVisible();
      const discovery = page.locator(".r13-entity-discovery");
      expect(await archive.evaluate((node, target) =>
        Boolean(node.compareDocumentPosition(target as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await discovery.elementHandle())).toBe(true);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: path.join(screenshotRoot, `${item.name}-1440x900-full.png`), fullPage: true });
      await discovery.screenshot({ path: path.join(screenshotRoot, `${item.name}-1440x900-discovery.png`) });
      results[item.name] = { route: item.route, ...metrics };
    }
    expectRuntimeClean(runtime);
    await writeFile(path.join(evidenceRoot, "R13_3D_BROWSER_CASE_AUDIT.json"), `${JSON.stringify({ results, runtime }, null, 2)}\n`);
  });

  test("passes all six required responsive widths without overflow", async ({ page }) => {
    test.setTimeout(90_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime = watchRuntime(page);
    const viewports = [
      { width: 390, height: 844, route: "/artists/artist-1132392/", heading: "从作品年表继续", name: "artist" },
      { width: 768, height: 1024, route: "/genres/core/alternative-rock/", heading: "从这一专题继续", name: "topic" },
      { width: 1024, height: 900, route: "/artists/artist-12127888/", heading: "从唯一作品向外继续", name: "artist-single" },
      { width: 1280, height: 900, route: "/scenes/commute/", heading: "从这一专题继续", name: "topic-context" },
      { width: 1440, height: 900, route: "/artists/artist-12084497/", heading: "从作品年表继续", name: "artist-two" },
      { width: 2048, height: 1152, route: "/decades/1950s/", heading: "从这一专题继续", name: "topic-era" },
    ] as const;
    const results = [];
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(viewport.route);
      await auditEntitySurface(page, viewport.heading);
      const overflow = await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(screenshotRoot, `responsive-${viewport.name}-${viewport.width}.png`),
        fullPage: true,
      });
      results.push({ ...viewport, overflow });
    }
    expectRuntimeClean(runtime);
    await writeFile(path.join(evidenceRoot, "R13_3D_RESPONSIVE_AUDIT.json"), `${JSON.stringify({ results, runtime }, null, 2)}\n`);
  });

  test("keeps mixed Album, Artist and Topic paths deterministic across Back, refresh and deep links", async ({ page }) => {
    const runtime = watchRuntime(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/albums/wake-after-the-rain/");
    const artistLink = page.locator(".album-detail__artists a").first();
    const artistHref = await artistLink.getAttribute("href");
    expect(artistHref).toMatch(/\/artists\/artist-\d+\/?\?entry=album&entryKey=wake-after-the-rain&trail=wake-after-the-rain/);
    await artistLink.click();
    await expect(page.getByRole("navigation", { name: "当前发现路径" })).toContainText("在雨后醒来");
    const artistPrimary = page.locator(".r13-entity-discovery__primary");
    const firstTarget = await artistPrimary.getAttribute("href");
    expect(firstTarget).not.toContain("/albums/wake-after-the-rain?");
    const artistDeepLink = page.url();
    const deterministicHref = await artistPrimary.getAttribute("href");
    await page.reload();
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveAttribute("href", deterministicHref ?? "");
    await page.goto(firstTarget!);
    const topicLink = page.locator(".signal-groups a").first();
    const topicHref = await topicLink.getAttribute("href");
    expect(topicHref).toContain("trail=");
    await topicLink.click();
    const topicPrimary = page.locator(".r13-entity-discovery__primary");
    const topicTarget = await topicPrimary.getAttribute("href");
    expect(topicTarget).not.toBeNull();
    await page.screenshot({ path: path.join(screenshotRoot, "mixed-album-artist-topic-mobile.png"), fullPage: true });
    const topicDeepLink = page.url();
    await page.reload();
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveAttribute("href", topicTarget ?? "");
    await page.goBack();
    await expect(page).toHaveURL(/\/albums\//);
    await page.goto(artistDeepLink);
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveAttribute("href", deterministicHref ?? "");
    await page.goto(topicDeepLink);
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveAttribute("href", topicTarget ?? "");
    expectRuntimeClean(runtime);
  });

  test("has semantic headings, visible keyboard focus and no motion dependency", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/artists/artist-1132392/");
    const discovery = page.locator(".r13-entity-discovery");
    await auditEntitySurface(page, "从作品年表继续");
    expect(await discovery.locator("h2").count()).toBe(1);
    expect(await discovery.locator("h3").count()).toBeGreaterThanOrEqual(1);
    const animations = await discovery.locator(".album-cover").first().evaluate((element) => ({
      animation: getComputedStyle(element).animationName,
      duration: getComputedStyle(element).animationDuration,
    }));
    expect(animations.animation).toBe("none");
    expect(Number.parseFloat(animations.duration)).toBeLessThanOrEqual(0.00001);
  });

  test("renders the local Human Quicklook with every screenshot resolved", async ({ page }) => {
    const dossier = path.join(evidenceRoot, "R13_3D_HUMAN_QUICKLOOK.html");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(pathToFileURL(dossier).href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Artist / Topic");
    const images = page.locator("img");
    await expect(images).toHaveCount(11);
    expect(await images.evaluateAll((items) => items.filter((item) => {
      const image = item as HTMLImageElement;
      return !image.complete || image.naturalWidth === 0;
    }).length)).toBe(0);
    await page.screenshot({ path: path.join(screenshotRoot, "human-quicklook-preview.png"), fullPage: true });
  });
});
