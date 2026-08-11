import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const evidenceRoot = path.resolve(
  ".local-data/r13-product-evolution/r13-3c-album-discovery/night-machine-review",
);
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const forbiddenRuntimeHost = /musicbrainz|coverartarchive|music\.163|rateyourmusic|spotify|apple|last\.fm|discogs/i;

const reviewCases = [
  { name: "same-primary-genre", route: "/albums/hypochondriac-brakence/" },
  { name: "chronology-min-pool", route: "/albums/netease-2085451/" },
  { name: "shared-secondary", route: "/albums/agaetis-byrjun/" },
  { name: "shared-context", route: "/albums/kind-of-blue/" },
  { name: "multi-work-artist", route: "/albums/from-sand-to-wave/" },
  { name: "single-work-artist", route: "/albums/netease-163444848/" },
  { name: "three-alternates", route: "/albums/wake-after-the-rain/" },
  { name: "direct-entry", route: "/albums/ok-computer/" },
] as const;

const requiredViewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-2048", width: 2048, height: 1127 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

function watchRuntime(page: Page) {
  const state = {
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    httpErrors: [] as string[],
    requestFailures: [] as string[],
    externalRequests: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") state.requestFailures.push(`${request.url()} ${failure}`);
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

async function waitForImages(page: Page) {
  await page.locator(".r13-discovery").scrollIntoViewIfNeeded();
  const images = page.locator(".r13-discovery img");
  await expect.poll(
    () => images.evaluateAll((items) => items.every((item) => {
      const image = item as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    })),
    { timeout: 8_000 },
  ).toBe(true);
  await images.evaluateAll(async (items) => {
    await Promise.all(items.map(async (item) => {
      const image = item as HTMLImageElement;
      if (typeof image.decode === "function") await image.decode().catch(() => undefined);
    }));
  });
}

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
}

async function auditDiscovery(page: Page) {
  const discovery = page.locator(".r13-discovery");
  await expect(discovery).toHaveCount(1);
  await expect(discovery).toBeVisible();
  await expect(discovery.getByRole("heading", { level: 2, name: "继续发现" })).toBeVisible();
  const primary = discovery.locator(".r13-discovery__primary");
  const alternates = discovery.locator(".r13-discovery__alternates li > a");
  await expect(primary).toHaveCount(1);
  const alternateCount = await alternates.count();
  expect(alternateCount).toBeLessThanOrEqual(3);
  await expect(discovery).not.toContainText(/SAME_PRIMARY_GENRE|CHRONOLOGICAL_NEIGHBOR|SHARED_LISTENING_CONTEXT|SPECIFIC|COMPOUND|FALLBACK|candidatePool|rankKey|相似度|匹配度|\d+%/);
  await expect(discovery.locator(".album-grid")).toHaveCount(0);

  const primaryCover = primary.locator(".album-cover");
  const primaryCoverBox = await primaryCover.boundingBox();
  const primaryTitle = primary.locator("h3");
  const primaryTitleSize = Number.parseFloat(await primaryTitle.evaluate((element) => getComputedStyle(element).fontSize));
  const alternateCoverBox = alternateCount ? await alternates.first().locator(".album-cover").boundingBox() : null;
  const alternateTitleSize = alternateCount
    ? Number.parseFloat(await alternates.first().locator("h3").evaluate((element) => getComputedStyle(element).fontSize))
    : null;
  expect(primaryCoverBox).not.toBeNull();
  if (alternateCoverBox) expect(primaryCoverBox!.width).toBeGreaterThan(alternateCoverBox.width * 2);
  if (alternateTitleSize) expect(primaryTitleSize).toBeGreaterThan(alternateTitleSize * 1.25);

  const imageMetrics = await discovery.locator("img.album-cover").evaluateAll((images) => images.map((item) => {
    const image = item as HTMLImageElement;
    const box = image.getBoundingClientRect();
    return {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      width: box.width,
      height: box.height,
    };
  }));
  for (const image of imageMetrics) {
    expect(image.complete).toBe(true);
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.naturalHeight).toBeGreaterThan(0);
    expect(Math.abs(image.width - image.height)).toBeLessThanOrEqual(1.5);
  }

  const textMetrics = await discovery.locator("h2, h3, .r13-discovery__reason, .r13-discovery__action, .r13-discovery__path").evaluateAll((elements) => elements.map((element) => {
    const item = element as HTMLElement;
    const box = item.getBoundingClientRect();
    return {
      text: item.textContent?.trim().slice(0, 80) ?? "",
      width: box.width,
      height: box.height,
      right: box.right,
      viewportWidth: window.innerWidth,
      visible: getComputedStyle(item).visibility !== "hidden" && getComputedStyle(item).display !== "none",
    };
  }));
  for (const item of textMetrics) {
    expect(item.text.length).toBeGreaterThan(0);
    expect(item.width).toBeGreaterThan(0);
    expect(item.height).toBeGreaterThan(0);
    expect(item.right).toBeLessThanOrEqual(item.viewportWidth + 1);
    expect(item.visible).toBe(true);
  }

  await primary.focus();
  const focusStyle = await primary.evaluate((element) => ({
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth,
  }));
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);

  const overflow = await noHorizontalOverflow(page);
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.clientWidth + 1);
  return {
    sourceSlug: await discovery.getAttribute("data-discovery-source"),
    primarySlug: await discovery.getAttribute("data-discovery-primary"),
    alternateCount,
    primaryCoverWidth: primaryCoverBox!.width,
    alternateCoverWidth: alternateCoverBox?.width ?? null,
    primaryTitleSize,
    alternateTitleSize,
    imageCount: imageMetrics.length,
    overflow,
  };
}

test.describe("R13 Night Run objective Album discovery review", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns Night Run machine review.");

  test("audits required real-catalog cases and required viewports", async ({ page }) => {
    test.setTimeout(120_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime = watchRuntime(page);
    const caseResults: Record<string, unknown> = {};

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const item of reviewCases) {
      await page.goto(item.route);
      await waitForImages(page);
      const metrics = await auditDiscovery(page);
      caseResults[item.name] = { route: item.route, viewport: "1440x900", metrics };
      const discovery = page.locator(".r13-discovery");
      const hiddenHeader = await page.addStyleTag({ content: ".site-header, .skip-link { visibility: hidden !important; }" });
      await discovery.screenshot({ path: path.join(screenshotRoot, `${item.name}-1440x900-discovery.png`) });
      await hiddenHeader.evaluate((element) => element.parentNode?.removeChild(element));
    }

    const viewportResults: Record<string, unknown> = {};
    for (const viewport of requiredViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/albums/ok-computer/");
      await waitForImages(page);
      const metrics = await auditDiscovery(page);
      viewportResults[viewport.name] = { width: viewport.width, height: viewport.height, metrics };
      const cleanEvidenceChrome = await page.addStyleTag({ content: ".skip-link { visibility: hidden !important; }" });
      await page.screenshot({ path: path.join(screenshotRoot, `direct-entry-${viewport.width}x${viewport.height}-full.png`), fullPage: true });
      await cleanEvidenceChrome.evaluate((element) => element.parentNode?.removeChild(element));
      const discovery = page.locator(".r13-discovery");
      const hiddenHeader = await page.addStyleTag({ content: ".site-header, .skip-link { visibility: hidden !important; }" });
      await discovery.screenshot({ path: path.join(screenshotRoot, `direct-entry-${viewport.width}x${viewport.height}-discovery.png`) });
      await hiddenHeader.evaluate((element) => element.parentNode?.removeChild(element));
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/albums/wake-after-the-rain/");
    const nextHref = await page.locator(".r13-discovery__primary").getAttribute("href");
    expect(nextHref).not.toBeNull();
    await page.goto(nextHref!);
    await waitForImages(page);
    const discoveryEntryMetrics = await auditDiscovery(page);
    const arrival = page.getByRole("navigation", { name: "当前发现路径" });
    await expect(arrival).toContainText("从《在雨后醒来》继续到这里");
    const navFontSize = Number.parseFloat(await arrival.evaluate((element) => getComputedStyle(element).fontSize));
    const sectionTitleSize = Number.parseFloat(await page.locator(".r13-discovery h2").evaluate((element) => getComputedStyle(element).fontSize));
    expect(sectionTitleSize).toBeGreaterThan(navFontSize * 2);
    const cleanEvidenceChrome = await page.addStyleTag({ content: ".skip-link { visibility: hidden !important; }" });
    await page.screenshot({ path: path.join(screenshotRoot, "discovery-entry-390x844-full.png"), fullPage: true });
    await cleanEvidenceChrome.evaluate((element) => element.parentNode?.removeChild(element));
    const hiddenHeader = await page.addStyleTag({ content: ".site-header, .skip-link { visibility: hidden !important; }" });
    await page.locator(".r13-discovery").screenshot({ path: path.join(screenshotRoot, "discovery-entry-390x844-discovery.png") });
    await hiddenHeader.evaluate((element) => element.parentNode?.removeChild(element));

    await page.goto("/albums/ok-computer/");
    await expect(page.getByRole("navigation", { name: "当前发现路径" })).toHaveCount(0);
    await page.goto("/albums/fantasy-jay-chou/");
    const order = await page.locator(".album-detail__content > section").evaluateAll((sections) =>
      sections.map((section) => section.getAttribute("aria-labelledby")),
    );
    expect(order.indexOf("same-artist-title")).toBeLessThan(order.indexOf("album-recommendations-title"));
    const sameArtistHrefs = await page.locator(".pa-same-artist-shelf a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    const primaryHref = await page.locator(".r13-discovery__primary").getAttribute("href");
    const adjacentDuplicate = sameArtistHrefs.some((href) => href && primaryHref?.startsWith(href));
    if (adjacentDuplicate) await expect(page.locator(".r13-discovery__primary .r13-discovery__reason")).not.toBeEmpty();

    expect(runtime.consoleErrors).toEqual([]);
    expect(runtime.pageErrors).toEqual([]);
    expect(runtime.httpErrors).toEqual([]);
    expect(runtime.requestFailures).toEqual([]);
    expect(runtime.externalRequests).toEqual([]);

    await writeFile(path.join(evidenceRoot, "R13_3C_MACHINE_VISUAL_AUDIT.json"), `${JSON.stringify({
      schema: "r13-3c-machine-visual-audit/v1",
      generatedAt: "2026-08-10",
      verdict: "READY_FOR_R13_3C_HUMAN_VISUAL_REVIEW",
      objectiveCorrectionsMade: 0,
      humanVisualAcceptance: "PENDING",
      caseResults,
      viewportResults,
      discoveryEntry: {
        route: nextHref,
        metrics: discoveryEntryMetrics,
        arrivalContextFontSize: navFontSize,
        sectionTitleFontSize: sectionTitleSize,
      },
      runtime: {
        externalRequests: runtime.externalRequests.length,
        consoleErrors: runtime.consoleErrors.length,
        pageErrors: runtime.pageErrors.length,
        httpErrors: runtime.httpErrors.length,
        requestFailures: runtime.requestFailures.length,
      },
    }, null, 2)}\n`, "utf8");
  });

  test("renders the concise human quicklook with every image resolved", async ({ page }) => {
    const quicklook = path.resolve(
      ".local-data/r13-product-evolution/r13-3c-album-discovery/R13_3C_HUMAN_REVIEW_QUICKLOOK.html",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(pathToFileURL(quicklook).href);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("继续发现");
    const images = page.locator("img");
    await expect(images).toHaveCount(15);
    expect(await images.evaluateAll((items) => items.filter((item) => {
      const image = item as HTMLImageElement;
      return !image.complete || image.naturalWidth === 0;
    }).length)).toBe(0);
    await page.screenshot({ path: path.join(evidenceRoot, "R13_3C_HUMAN_REVIEW_QUICKLOOK_PREVIEW.png"), fullPage: true });
  });
});
