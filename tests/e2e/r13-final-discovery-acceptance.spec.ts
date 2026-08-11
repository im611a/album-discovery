import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const evidenceRoot = path.resolve(
  ".local-data/r13-product-evolution/r13-3f-final-acceptance",
);
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

async function expectBoundedContext(href: string | null) {
  expect(href).not.toBeNull();
  const url = new URL(href!, "http://127.0.0.1:4311");
  for (const key of ["trail", "via"]) {
    const tokens = url.searchParams.get(key)?.split("~").filter(Boolean) ?? [];
    expect(tokens.length).toBeLessThanOrEqual(3);
  }
  return url;
}

async function waitForLocalArtwork(page: Page, selector: string) {
  const images = page.locator(`${selector} img.album-cover`);
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((item) => {
      const albumImage = item as HTMLImageElement;
      return albumImage.complete && albumImage.naturalWidth > 0;
    })).toBe(true);
  }
}

test.describe("R13-3F final discovery product acceptance", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns final R13 discovery evidence.");

  test("exercises Album primary, alternate, reset, direct-entry, and personal-state isolation", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/albums/wake-after-the-rain/");
    const originalPrimary = await page.locator(".r13-discovery__primary").getAttribute("href");
    const alternate = await page.locator(".r13-discovery__alternates li a").first().getAttribute("href");
    expect(originalPrimary).not.toBe(alternate);
    await expectBoundedContext(originalPrimary);
    await expectBoundedContext(alternate);

    await page.locator(".r13-discovery__primary").click();
    await expect(page.locator(".r13-discovery__path")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotRoot, "01-album-primary-continuation.png"), fullPage: true });
    await page.goBack();
    await page.locator(".r13-discovery__alternates li a").first().click();
    await expect(page.locator(".r13-discovery__path")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotRoot, "02-album-alternate-continuation.png"), fullPage: true });
    const reset = page.getByRole("link", { name: "从本专辑重新开始" });
    const resetHref = await reset.getAttribute("href");
    const resetUrl = new URL(resetHref!, "http://127.0.0.1:4311");
    expect(resetUrl.search).toBe("");
    await reset.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(resetUrl.pathname);
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(page.locator(".r13-discovery__path")).toHaveCount(0);

    await page.goto("/albums/wake-after-the-rain/");
    await page.evaluate(() => localStorage.setItem("album-discovery:user-state:v1", JSON.stringify({
      version: 1,
      taste: { genres: ["pop"], descriptors: [], contexts: ["night"], eras: ["2020s"], seedAlbumIds: [], exploration: "exploratory" },
      likedAlbumIds: ["album:78321108"], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [],
      dismissedAlbumIds: ["album:78321108"], recommendationFeedback: { "album:78321108": "not_for_me" },
      recentAlbumIds: [], onboardingCompleted: true, updatedAt: "2026-08-11T00:00:00.000Z",
    })));
    await page.reload();
    await expect(page.locator(".r13-discovery__primary")).toHaveAttribute("href", originalPrimary ?? "");

    await page.goto("/albums/ok-computer/");
    await expect(page.locator(".r13-discovery__path")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/从《.+》继续到这里/);
    expectRuntimeClean(runtime);
    await writeFile(path.join(evidenceRoot, "R13_3F_ALBUM_JOURNEY_AUDIT.json"), `${JSON.stringify({
      primary: originalPrimary,
      alternate,
      resetRemovesProvenance: true,
      directEntryFalsePreviousClaim: false,
      personalStateChangedRanking: false,
      runtime,
    }, null, 2)}\n`);
  });

  test("exercises Album→Artist, multi/single Artist, and all four Topic families", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/albums/fantasy-jay-chou/");
    const artistLink = page.locator(".album-detail__artists a").first();
    await expect(artistLink).toHaveAttribute("href", /entry=album&entryKey=fantasy-jay-chou&trail=fantasy-jay-chou/);
    await artistLink.click();
    await expect(page.getByRole("navigation", { name: "当前发现路径" })).toContainText("范特西");
    await expect(page.getByRole("heading", { level: 2, name: "从作品年表继续" })).toBeVisible();
    const contextualArtistTarget = await page.locator(".r13-entity-discovery__primary").getAttribute("href");
    await expectBoundedContext(contextualArtistTarget);
    await page.screenshot({ path: path.join(screenshotRoot, "03-album-to-artist-context.png"), fullPage: true });
    await page.locator(".r13-entity-discovery__primary").click();
    await expect(page.locator(".r13-discovery")).toBeVisible();

    await page.goto("/artists/artist-1132392/");
    await expect(page.getByRole("heading", { level: 2, name: "从作品年表继续" })).toBeVisible();
    await expect(page.locator(".r12-discography")).toBeVisible();
    const chronologyTarget = await page.locator(".r13-entity-discovery__primary").getAttribute("href");
    await page.screenshot({ path: path.join(screenshotRoot, "04-multi-work-artist-chronology.png"), fullPage: true });
    await page.locator(".r13-entity-discovery__primary").click();
    const escapeTargets: string[] = [];
    for (let step = 0; step < 4; step += 1) {
      const href = await page.locator(".r13-discovery__primary").getAttribute("href");
      const url = await expectBoundedContext(href);
      const targetSlug = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
      escapeTargets.push(`${url.pathname}${url.search}`);
      await page.locator(".r13-discovery__primary").click();
      await expect(page).toHaveURL(url.toString());
      await expect(page.locator(".r13-discovery")).toHaveAttribute("data-discovery-source", targetSlug);
    }
    expect(new Set(escapeTargets).size).toBe(escapeTargets.length);

    await page.goto("/artists/artist-12127888/");
    await expect(page.getByRole("heading", { level: 2, name: "从唯一作品向外继续" })).toBeVisible();
    await expect(page.locator(".r13-entity-discovery__reason").first()).toContainText("唯一作品");
    await page.screenshot({ path: path.join(screenshotRoot, "05-single-work-artist-escape.png"), fullPage: true });
    await page.locator(".r13-entity-discovery__primary").click();
    await expect(page.locator(".r13-discovery")).toBeVisible();

    const topics = [
      ["primary-genre", "/genres/core/alternative-rock/"],
      ["secondary-genre", "/genres/related/2-step/"],
      ["era", "/decades/1950s/"],
      ["listening-context", "/scenes/commute/"],
    ] as const;
    const topicTargets: Record<string, string | null> = {};
    for (const [kind, route] of topics) {
      await page.goto(route);
      await expect(page.locator(".album-grid")).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "从这一专题继续" })).toBeVisible();
      topicTargets[kind] = await page.locator(".r13-entity-discovery__primary").getAttribute("href");
      await expectBoundedContext(topicTargets[kind]);
      await page.screenshot({ path: path.join(screenshotRoot, `06-topic-${kind}.png`), fullPage: true });
      await page.locator(".r13-entity-discovery__primary").click();
      await expect(page.locator(".r13-discovery")).toBeVisible();
    }
    expectRuntimeClean(runtime);
    await writeFile(path.join(evidenceRoot, "R13_3F_ARTIST_TOPIC_JOURNEY_AUDIT.json"), `${JSON.stringify({
      contextualArtistTarget,
      chronologyTarget,
      boundedMultiWorkTargets: escapeTargets,
      singleWorkEscape: true,
      topicTargets,
      runtime,
    }, null, 2)}\n`);
  });

  test("keeps Explore relation/random distinct through a deterministic mixed multi-hop path", async ({ page }) => {
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const relationRoute = "/explore/?mode=genre&value=alternative-rock&kind=core";
    await page.goto(relationRoute);
    const relation = page.locator('[data-explore-authority="relation"]');
    const relationTarget = await relation.locator(".r13-explore-entry__primary").getAttribute("href");
    const explanation = await relation.locator(".r13-explore-entry__reason").first().innerText();
    await page.reload();
    await expect(page.locator('[data-explore-authority="relation"] .r13-explore-entry__primary'))
      .toHaveAttribute("href", relationTarget ?? "");
    await page.screenshot({ path: path.join(screenshotRoot, "07-explore-relation-entry.png"), fullPage: true });
    await page.locator('[data-explore-authority="relation"] .r13-explore-entry__primary').click();
    await expect(page.locator(".r13-discovery")).toBeVisible();

    const artistLink = page.locator(".album-detail__artists a").first();
    await expect(artistLink).toHaveAttribute("href", /entry=explore/);
    await artistLink.click();
    await expect(page.locator(".r13-entity-discovery--artist")).toBeVisible();
    await page.locator(".r13-entity-discovery__primary").click();
    const topicLink = page.locator(".signal-groups a").first();
    await expect(topicLink).toHaveAttribute("href", /entry=explore/);
    await topicLink.click();
    await expect(page.locator(".r13-entity-discovery--topic")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotRoot, "08-mixed-album-artist-topic-path.png"), fullPage: true });
    const mixedTarget = await page.locator(".r13-entity-discovery__primary").getAttribute("href");
    await expectBoundedContext(mixedTarget);
    await page.reload();
    await expect(page.locator(".r13-entity-discovery__primary")).toHaveAttribute("href", mixedTarget ?? "");
    await page.goBack();
    await expect(page).toHaveURL(/\/albums\//);

    await page.goto("/explore/?mode=random&seed=r13-final-smoke");
    const random = page.locator('[data-explore-authority="serendipity"]');
    await expect(random).toBeVisible();
    await expect(page.locator('[data-explore-authority="relation"]')).toHaveCount(0);
    await expect(random.locator(".r13-explore-entry__source")).toHaveCount(0);
    await expect(random).toContainText("不是相似关系、推荐结论或热度排序");
    const randomTarget = await random.locator(".r13-explore-entry__primary").getAttribute("href");
    await page.reload();
    await expect(page.locator('[data-explore-authority="serendipity"] .r13-explore-entry__primary'))
      .toHaveAttribute("href", randomTarget ?? "");
    await page.screenshot({ path: path.join(screenshotRoot, "09-explore-explicit-random.png"), fullPage: true });
    await page.locator('[data-explore-authority="serendipity"] .r13-explore-entry__primary').click();
    await expect(page.locator(".r13-discovery")).toBeVisible();
    expectRuntimeClean(runtime);
    await writeFile(path.join(evidenceRoot, "R13_3F_EXPLORE_MIXED_JOURNEY_AUDIT.json"), `${JSON.stringify({
      relationRoute,
      relationTarget,
      relationExplanation: explanation,
      mixedTarget,
      randomTarget,
      randomRelationClaim: false,
      deterministicReplayFailures: 0,
      runtime,
    }, null, 2)}\n`);
  });

  test("passes final responsive, keyboard, zoom, focus, artwork, and reduced-motion smoke", async ({ page }) => {
    test.setTimeout(120_000);
    const runtime = watchRuntime(page);
    await mkdir(screenshotRoot, { recursive: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const viewports = [
      { width: 390, height: 844, route: "/albums/wake-after-the-rain/", surface: ".r13-discovery", name: "album-mobile" },
      { width: 768, height: 1024, route: "/artists/artist-1132392/", surface: ".r13-entity-discovery", name: "artist-tablet" },
      { width: 1024, height: 768, route: "/genres/core/alternative-rock/", surface: ".r13-entity-discovery", name: "topic-standard" },
      { width: 1440, height: 900, route: "/explore/?mode=scene&value=commute", surface: ".r13-explore-entry", name: "explore-desktop" },
      { width: 2048, height: 1127, route: "/albums/ok-computer/", surface: ".r13-discovery", name: "album-wide" },
    ] as const;
    const results = [];
    for (const item of viewports) {
      await page.setViewportSize({ width: item.width, height: item.height });
      await page.goto(item.route);
      const surface = page.locator(item.surface).first();
      await expect(surface).toBeVisible();
      await waitForLocalArtwork(page, item.surface);
      const overflow = await expectNoHorizontalOverflow(page);
      const primary = surface.locator('a[class*="__primary"]').first();
      await primary.focus();
      await expect(primary).toBeFocused();
      const focusAndMotion = await primary.evaluate((element) => ({
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: Number.parseFloat(getComputedStyle(element).outlineWidth),
        animationName: getComputedStyle(element).animationName,
        animationDuration: Number.parseFloat(getComputedStyle(element).animationDuration),
        transitionDuration: Number.parseFloat(getComputedStyle(element).transitionDuration),
      }));
      expect(focusAndMotion.outlineStyle).not.toBe("none");
      expect(focusAndMotion.outlineWidth).toBeGreaterThanOrEqual(2);
      expect(focusAndMotion.animationName).toBe("none");
      expect(focusAndMotion.animationDuration).toBeLessThanOrEqual(0.00001);
      expect(focusAndMotion.transitionDuration).toBeLessThanOrEqual(0.00001);
      const art = await surface.locator(".album-cover").evaluateAll((covers) => covers.map((cover) => {
        const box = cover.getBoundingClientRect();
        return { width: box.width, height: box.height, delta: Math.abs(box.width - box.height) };
      }));
      expect(art.every((cover) => cover.width > 0 && cover.height > 0 && cover.delta <= 2)).toBe(true);
      await page.screenshot({ path: path.join(screenshotRoot, `10-responsive-${item.name}-${item.width}.png`), fullPage: true });
      results.push({ ...item, overflow, focusAndMotion, artwork: art });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/explore/?mode=scene&value=commute");
    const keyboardTarget = page.locator('[data-explore-authority="relation"] .r13-explore-entry__primary');
    await keyboardTarget.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/albums\//);
    await expect(page.locator(".r13-discovery")).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    const zoomOverflow = await expectNoHorizontalOverflow(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    expectRuntimeClean(runtime);
    await writeFile(path.join(evidenceRoot, "R13_3F_RESPONSIVE_ACCESSIBILITY_AUDIT.json"), `${JSON.stringify({
      results,
      keyboardNavigation: true,
      reducedMotion: true,
      pageScale200Percent: { pass: true, overflow: zoomOverflow },
      runtime,
    }, null, 2)}\n`);
  });
});
