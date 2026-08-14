import path from "node:path";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { resolveRegressionEvidenceRoot } from "./helpers/evidence-output";

const evidenceRoot = resolveRegressionEvidenceRoot({ phase: "r13-3c", environmentValue: process.env.R13_3C_EVIDENCE_ROOT });
const forbiddenRuntimeHost = /musicbrainz|coverartarchive|music\.163|rateyourmusic/i;

function watchRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: string[] = [];
  const requestFailures: string[] = [];
  const forbiddenRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText !== "net::ERR_ABORTED") requestFailures.push(`${request.url()} ${errorText}`);
  });
  page.on("request", (request) => {
    if (forbiddenRuntimeHost.test(request.url())) forbiddenRequests.push(request.url());
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4311") {
      externalRequests.push(request.url());
    }
  });
  return { consoleErrors, pageErrors, httpErrors, requestFailures, forbiddenRequests, externalRequests };
}

function expectRuntimeClean(runtime: ReturnType<typeof watchRuntime>) {
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.requestFailures).toEqual([]);
  expect(runtime.forbiddenRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const measurement = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
  expect(measurement.scrollWidth, JSON.stringify(measurement)).toBeLessThanOrEqual(measurement.clientWidth + 1);
}

test.describe("R13-3C album continuous discovery", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns R13-3C evidence.");

  test("renders one explainable authority after same-artist chronology", async ({ page }) => {
    const runtime = watchRuntime(page);
    await page.goto("/albums/fantasy-jay-chou/");
    const sections = await page.locator(".album-detail__content > section").evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-labelledby")),
    );
    expect(sections.indexOf("same-artist-title")).toBeLessThan(sections.indexOf("album-recommendations-title"));
    expect(sections.filter((id) => id === "album-recommendations-title")).toHaveLength(1);

    const discovery = page.locator(".r13-discovery");
    await expect(discovery.getByRole("heading", { level: 2, name: "继续发现" })).toBeVisible();
    await expect(discovery.locator(".r13-discovery__primary")).toHaveCount(1);
    expect(await discovery.locator(".r13-discovery__alternates li").count()).toBeLessThanOrEqual(3);
    await expect(discovery.locator(".album-grid")).toHaveCount(0);
    await expect(discovery).not.toContainText(/相似度|匹配度|候选数|SPECIFIC|COMPOUND|FALLBACK|\d+%/);
    await expect(discovery.locator(".r13-discovery__reason").first()).not.toBeEmpty();
    expectRuntimeClean(runtime);
  });

  test("preserves deterministic deep links, refresh, Back, and P0 state separation", async ({ page }) => {
    const runtime = watchRuntime(page);
    await page.goto("/albums/wake-after-the-rain/");
    const sourcePrimary = await page.locator(".r13-discovery").getAttribute("data-discovery-primary");
    const primary = page.locator(".r13-discovery__primary");
    const href = await primary.getAttribute("href");
    expect(href).toMatch(/entry=album.*entryKey=wake-after-the-rain.*trail=wake-after-the-rain.*via=/);

    await page.evaluate(() => localStorage.setItem("album-discovery:user-state:v1", JSON.stringify({
      version: 1,
      taste: { genres: ["hip-hop"], descriptors: [], contexts: ["night"], eras: ["2020s"], seedAlbumIds: [], exploration: "exploratory" },
      likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [],
      dismissedAlbumIds: ["album:78321108"],
      recommendationFeedback: { "album:78321108": "not_for_me" },
      recentAlbumIds: [], onboardingCompleted: true, updatedAt: "2026-08-10T00:00:00.000Z",
    })));
    await page.reload();
    await expect(page.locator(".r13-discovery")).toHaveAttribute("data-discovery-primary", sourcePrimary ?? "");

    await primary.click();
    await expect(page).toHaveURL(/\/albums\/[^/?]+\/\?entry=album&entryKey=wake-after-the-rain&trail=wake-after-the-rain&via=/);
    await expect(page.getByRole("navigation", { name: "当前发现路径" })).toContainText("从《在雨后醒来》继续到这里");
    const continuedPrimary = await page.locator(".r13-discovery").getAttribute("data-discovery-primary");
    expect(continuedPrimary).not.toBe("wake-after-the-rain");
    const deepLink = page.url();
    await page.reload();
    await expect(page.locator(".r13-discovery")).toHaveAttribute("data-discovery-primary", continuedPrimary ?? "");
    await page.goBack();
    await expect(page).toHaveURL(/\/albums\/wake-after-the-rain\/$/);
    await page.goto(deepLink);
    await expect(page.locator(".r13-discovery")).toHaveAttribute("data-discovery-primary", continuedPrimary ?? "");
    expectRuntimeClean(runtime);
  });

  test("has keyboard-readable links and respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/albums/ok-computer/");
    const discovery = page.locator(".r13-discovery");
    const links = discovery.getByRole("link");
    expect(await links.count()).toBeGreaterThanOrEqual(1);
    for (let index = 0; index < await links.count(); index += 1) {
      await expect(links.nth(index)).toHaveAccessibleName(/\S/);
    }
    await links.first().focus();
    await expect(links.first()).toBeFocused();
    const transitionDuration = await discovery.locator(".album-cover").first().evaluate((element) =>
      getComputedStyle(element).transitionDuration,
    );
    expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.00001);
  });

  test("passes six responsive viewports and records post-change evidence", async ({ page }) => {
    await mkdir(evidenceRoot, { recursive: true });
    const viewports = [
      [390, 844],
      [768, 1024],
      [1024, 900],
      [1280, 900],
      [1440, 900],
      [2048, 1152],
    ] as const;
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/albums/ok-computer/");
      const discovery = page.locator(".r13-discovery");
      await expect(discovery).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await discovery.screenshot({
        path: path.join(evidenceRoot, `after-ok-computer-${width}-discovery.png`),
      });
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: path.join(evidenceRoot, `after-ok-computer-${width === 390 ? "mobile" : "desktop"}-full.png`),
          fullPage: true,
        });
      }
    }
  });

  test("records representative human-review cases with full pages and clean section crops", async ({ page }) => {
    await mkdir(evidenceRoot, { recursive: true });
    const directCases = [
      ["primary-same-genre", "/albums/hypochondriac-brakence/"],
      ["primary-chronology-minimum-pool", "/albums/netease-2085451/"],
      ["primary-shared-secondary", "/albums/agaetis-byrjun/"],
      ["primary-shared-context", "/albums/kind-of-blue/"],
      ["multi-work-artist", "/albums/from-sand-to-wave/"],
      ["single-work-artist", "/albums/netease-163444848/"],
      ["three-alternates", "/albums/wake-after-the-rain/"],
      ["direct-entry", "/albums/ok-computer/"],
    ] as const;
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [name, route] of directCases) {
      await page.goto(route);
      const discovery = page.locator(".r13-discovery");
      await expect(discovery).toBeVisible();
      await page.screenshot({ path: path.join(evidenceRoot, `case-${name}-desktop-full.png`), fullPage: true });
      const hiddenHeader = await page.addStyleTag({ content: ".site-header { visibility: hidden !important; }" });
      await discovery.screenshot({ path: path.join(evidenceRoot, `case-${name}-desktop-discovery.png`) });
      await hiddenHeader.evaluate((element) => element.parentNode?.removeChild(element));
    }

    await page.goto("/albums/wake-after-the-rain/");
    const discoveryHref = await page.locator(".r13-discovery__primary").getAttribute("href");
    expect(discoveryHref).not.toBeNull();
    for (const [name, route] of [
      ["discovery-entry", discoveryHref!],
      ["direct-entry-mobile", "/albums/ok-computer/"],
    ] as const) {
      const mobile = name.endsWith("mobile") || name === "discovery-entry";
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.goto(route);
      const discovery = page.locator(".r13-discovery");
      await expect(discovery).toBeVisible();
      await page.screenshot({ path: path.join(evidenceRoot, `case-${name}-${mobile ? "mobile" : "desktop"}-full.png`), fullPage: true });
      const hiddenHeader = await page.addStyleTag({ content: ".site-header { visibility: hidden !important; }" });
      await discovery.screenshot({ path: path.join(evidenceRoot, `case-${name}-${mobile ? "mobile" : "desktop"}-discovery.png`) });
      await hiddenHeader.evaluate((element) => element.parentNode?.removeChild(element));
    }
  });

  test("renders the human-review dossier with every screenshot resolved", async ({ page }) => {
    const dossier = path.resolve(
      ".local-data/r13-product-evolution/r13-3c-album-discovery/R13_3C_REVIEWER_DOSSIER.html",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(pathToFileURL(dossier).href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("从档案对象");
    const images = page.locator("img");
    await expect(images).toHaveCount(24);
    expect(await images.evaluateAll((items) => items.filter((item) => {
      const image = item as HTMLImageElement;
      return !image.complete || image.naturalWidth === 0;
    }).length)).toBe(0);
    await page.screenshot({ path: path.join(evidenceRoot, "reviewer-dossier-preview.png"), fullPage: true });
  });
});
