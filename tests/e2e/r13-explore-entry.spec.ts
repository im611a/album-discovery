import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { resolveRegressionEvidenceRoot } from "./helpers/evidence-output";

const evidenceRoot = resolveRegressionEvidenceRoot({ phase: "r13-3e", environmentValue: process.env.R13_3E_EVIDENCE_ROOT });
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const forbiddenRuntimeHost = /musicbrainz|coverartarchive|music\.163|rateyourmusic|spotify|apple|last\.fm|discogs/i;

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
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth + 1);
  return metrics;
}

async function expectRelationSurface(page: Page) {
  const surface = page.locator('[data-explore-authority="relation"]');
  await expect(surface).toHaveCount(1);
  await expect(surface.getByRole("heading", { level: 2, name: "沿一条真实关系进入" })).toBeVisible();
  await expect(surface.locator(".r13-explore-entry__primary")).toHaveCount(1);
  expect(await surface.locator(".r13-explore-entry__alternates li").count()).toBeLessThanOrEqual(3);
  await expect(surface).not.toContainText(/猜你喜欢|热门|匹配度|相似度|AI 推荐|candidate|score|\d+%/iu);
  for (const link of await surface.getByRole("link").all()) await expect(link).toHaveAccessibleName(/\S/);
  const primary = surface.locator(".r13-explore-entry__primary");
  await primary.focus();
  await expect(primary).toBeFocused();
  const focus = await primary.evaluate((element) => ({
    style: getComputedStyle(element).outlineStyle,
    width: Number.parseFloat(getComputedStyle(element).outlineWidth),
  }));
  expect(focus.style).not.toBe("none");
  expect(focus.width).toBeGreaterThanOrEqual(2);
  return surface;
}

test.describe("R13-3E visible Explore continuous-discovery entry", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns R13-3E evidence.");

  test("continues from a relation entry into Album and the accepted Album discovery system", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/explore/?mode=genre&value=alternative-rock&kind=core");
    const surface = await expectRelationSurface(page);
    await page.screenshot({ path: path.join(screenshotRoot, "a-explore-desktop-overview.png"), fullPage: true });
    await surface.screenshot({ path: path.join(screenshotRoot, "b-relation-entry-state.png") });
    const target = await surface.locator(".r13-explore-entry__primary").getAttribute("href");
    expect(target).toMatch(/^\/albums\/.+\?entry=explore/);
    await surface.locator(".r13-explore-entry__primary").click();
    await expect(page).toHaveURL(/\/albums\/.*entry=explore/);
    await expect(page.locator(".r13-discovery")).toHaveCount(1);
    await expect(page.locator(".r13-discovery__primary")).toHaveCount(1);
    await page.screenshot({ path: path.join(screenshotRoot, "c-album-continuation-path.png"), fullPage: true });
    await page.locator(".r13-discovery__primary").click();
    await expect(page).toHaveURL(/\/albums\//);
    await expect(page.locator(".r13-discovery")).toHaveCount(1);
    expectRuntimeClean(runtime);
  });

  test("opens Artist and Topic sources from Explore and reaches their accepted continuations", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/explore/?mode=artist&value=netease-artist%3A1132392");
    let surface = await expectRelationSurface(page);
    const artistSource = surface.locator(".r13-explore-entry__source a");
    await expect(artistSource).toHaveAttribute("href", /\/artists\/artist-1132392\/?\?entry=explore/);
    await artistSource.click();
    await expect(page).toHaveURL(/\/artists\/artist-1132392\/.*entry=explore/);
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveCount(1);
    await page.screenshot({ path: path.join(screenshotRoot, "d-artist-continuation-from-explore.png"), fullPage: true });
    await page.locator(".r13-entity-discovery__primary").click();
    await expect(page.locator(".r13-discovery")).toHaveCount(1);

    await page.goto("/explore/?mode=genre&value=alternative-rock&kind=core");
    surface = await expectRelationSurface(page);
    const topicSource = surface.locator(".r13-explore-entry__source a");
    await expect(topicSource).toHaveAttribute("href", /\/genres\/core\/alternative-rock\/?\?entry=explore/);
    await topicSource.click();
    await expect(page).toHaveURL(/\/genres\/core\/alternative-rock\/.*entry=explore/);
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveCount(1);
    await page.screenshot({ path: path.join(screenshotRoot, "e-topic-continuation-from-explore.png"), fullPage: true });
    await page.locator(".r13-entity-discovery__primary").click();
    await expect(page.locator(".r13-discovery")).toHaveCount(1);
    expectRuntimeClean(runtime);
  });

  test("isolates stable random semantics from relation claims", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/explore/?mode=random&seed=shared-42");
    const surface = page.locator('[data-explore-authority="serendipity"]');
    await expect(surface).toHaveCount(1);
    await expect(surface.getByRole("heading", { level: 2, name: "偶然进入一张作品" })).toBeVisible();
    await expect(surface).toContainText("这不是相似关系、推荐结论或热度排序");
    await expect(surface).not.toHaveAttribute("data-explore-source-kind", /.+/);
    await expect(page.locator('[data-explore-authority="relation"]')).toHaveCount(0);
    await expect(surface.locator(".r13-explore-entry__source")).toHaveCount(0);
    const firstTarget = await surface.locator(".r13-explore-entry__primary").getAttribute("href");
    await page.reload();
    await expect(page.locator('[data-explore-authority="serendipity"] .r13-explore-entry__primary'))
      .toHaveAttribute("href", firstTarget ?? "");
    await page.screenshot({ path: path.join(screenshotRoot, "f-explicit-serendipity-entry.png"), fullPage: true });
    expectRuntimeClean(runtime);
  });

  test("preserves deterministic deep-link and Back state, including a 390px journey", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const deepLink = "/explore/?mode=scene&value=commute";
    await page.goto(deepLink);
    const surface = await expectRelationSurface(page);
    const primary = await surface.locator(".r13-explore-entry__primary").getAttribute("href");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(screenshotRoot, "g-explore-mobile-390.png"), fullPage: true });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await surface.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotRoot, "h-relation-result-mobile-390.png") });
    await page.reload();
    await expect(page.locator('[data-explore-authority="relation"] .r13-explore-entry__primary'))
      .toHaveAttribute("href", primary ?? "");
    await page.locator('[data-explore-authority="relation"] .r13-explore-entry__primary').click();
    await expect(page.locator(".r13-discovery")).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(/\/explore\/\?mode=scene&value=commute/);
    await expect(page.locator('[data-explore-authority="relation"] .r13-explore-entry__primary'))
      .toHaveAttribute("href", primary ?? "");
    expectRuntimeClean(runtime);
  });

  test("passes all six required responsive widths without overflow", async ({ page }) => {
    test.setTimeout(90_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime = watchRuntime(page);
    const viewports = [
      { width: 390, height: 844, mode: "genre", value: "alternative-rock", suffix: "&kind=core" },
      { width: 768, height: 1024, mode: "decade", value: "1990s", suffix: "" },
      { width: 1024, height: 900, mode: "scene", value: "commute", suffix: "" },
      { width: 1280, height: 900, mode: "artist", value: "netease-artist%3A1132392", suffix: "" },
      { width: 1440, height: 900, mode: "genre", value: "2-step", suffix: "&kind=related" },
      { width: 2048, height: 1152, mode: "random", value: "responsive-2048", suffix: "" },
    ] as const;
    const results = [];
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const route = viewport.mode === "random"
        ? `/explore/?mode=random&seed=${viewport.value}`
        : `/explore/?mode=${viewport.mode}&value=${viewport.value}${viewport.suffix}`;
      await page.goto(route);
      const authority = viewport.mode === "random" ? "serendipity" : "relation";
      await expect(page.locator(`[data-explore-authority="${authority}"]`)).toHaveCount(1);
      const overflow = await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(screenshotRoot, `responsive-${viewport.width}.png`),
        fullPage: true,
      });
      results.push({ ...viewport, route, authority, overflow });
    }
    expectRuntimeClean(runtime);
    await writeFile(
      path.join(evidenceRoot, "R13_3E_RESPONSIVE_BROWSER_AUDIT.json"),
      `${JSON.stringify({ results, runtime }, null, 2)}\n`,
    );
  });

  test("renders the local Human Quicklook with all eight review images resolved", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(pathToFileURL(path.join(evidenceRoot, "R13_3E_HUMAN_QUICKLOOK.html")).href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Visible Explore");
    const images = page.locator("img");
    await expect(images).toHaveCount(8);
    expect(await images.evaluateAll((items) => items.filter((item) => {
      const image = item as HTMLImageElement;
      return !image.complete || image.naturalWidth === 0;
    }).length)).toBe(0);
    await page.screenshot({ path: path.join(screenshotRoot, "human-quicklook-preview.png"), fullPage: true });
  });
});
