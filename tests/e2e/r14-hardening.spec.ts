import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { captureSettledVisual } from "./helpers/settled-visual";

const STORAGE_KEY = "album-discovery:user-state:v1";
const shotRoot = ".local-data/r14-product-evolution/r14-machine-capture-scratch/hardening";
const acceptedReviewRoot = ".local-data/r14-product-evolution/r14-3n-consolidated-human-review";
const acceptedScreenshotRoot = `${acceptedReviewRoot}/screenshots`;
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let acceptedEvidenceBefore = new Map<string, string>();

async function acceptedEvidenceHashes() {
  const files = [
    `${acceptedReviewRoot}/R14_3N_CONSOLIDATED_HUMAN_QUICKLOOK.html`,
    ...(await readdir(acceptedScreenshotRoot)).filter((name) => name.endsWith(".png")).map((name) => path.join(acceptedScreenshotRoot, name)),
  ];
  return new Map(await Promise.all(files.map(async (file) => [file.replaceAll("\\", "/"), sha256(await readFile(file))] as const)));
}
const seedIds = ["album:18915", "album:18905", "album:15190"];
const baseState = { version: 1, taste: { genres: [], descriptors: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" }, likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recommendationFeedback: {}, recentAlbumIds: [], onboardingCompleted: true, updatedAt: "2026-08-12T00:00:00.000Z" };
test.beforeAll(async () => {
  acceptedEvidenceBefore = await acceptedEvidenceHashes();
  await mkdir(shotRoot, { recursive: true });
});

test.afterAll(async () => {
  expect([...(await acceptedEvidenceHashes())]).toEqual([...acceptedEvidenceBefore]);
  await expect(access(path.join(shotRoot, "after-home-negative-1440.png"))).resolves.toBeUndefined();
});

function runtimeAudit(page: Page) {
  const audit = { console: [] as string[], page: [] as string[], http: [] as string[], external: [] as string[] };
  page.on("console", (message) => { if (message.type() === "error") audit.console.push(message.text()); });
  page.on("pageerror", (error) => audit.page.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) audit.http.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => { if (/musicbrainz|coverartarchive|music\.163|rateyourmusic|meinhardtaxer/i.test(request.url())) audit.external.push(request.url()); });
  return audit;
}

async function setState(page: Page, value: unknown) {
  await page.goto("/for-you/?hardeningSetup=1");
  await expect(page.locator(".r14-personal-journey[data-personal-status]")).toBeVisible();
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, typeof payload === "string" ? payload : JSON.stringify(payload)), { key: STORAGE_KEY, payload: value });
}

async function expectNoOverflow(page: Page) {
  const result = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(result.scroll).toBeLessThanOrEqual(result.client + 1);
}

async function capture(page: Page, filename: string, readySelector = "main") {
  return captureSettledVisual(page, { route: new URL(page.url()).pathname, readySelector }, { path: `${shotRoot}/${filename}`, fullPage: true });
}

test("R14-3H corrupt and unavailable storage degrade to truthful archive browsing", async ({ page }) => {
  const audit = runtimeAudit(page);
  await setState(page, "{bad json");
  await page.goto("/for-you/?visualTest=1");
  await expect(page.getByText("这里没有足够的个人线索")).toBeVisible();
  await capture(page, "after-for-you-corrupt-storage-1280.png", ".r14-for-you-journey");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("blocked storage"); } }));
  for (const route of ["/", "/for-you/", "/albums/fantasy-jay-chou/", "/artists/artist-6452/", "/explore/?mode=personal"]) {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}visualTest=1`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoOverflow(page);
  }
  expect(audit).toEqual({ console: [], page: [], http: [], external: [] });
});

test("R14-3L six widths, 100/200 percent, headings, IDs and image alternatives remain valid", async ({ page, browserName }) => {
  test.setTimeout(75_000);
  const audit = runtimeAudit(page);
  await setState(page, { ...baseState, likedAlbumIds: [seedIds[0]], recentAlbumIds: [seedIds[1]] });
  for (const width of [390, 768, 1024, 1280, 1440, 2048]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const route of ["/for-you/", "/albums/fantasy-jay-chou/", "/artists/artist-6452/", "/explore/?mode=personal"]) {
      await page.goto(`${route}${route.includes("?") ? "&" : "?"}visualTest=1`);
      await expectNoOverflow(page);
      const structure = await page.evaluate(() => {
        const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
        const imagesWithoutAlt = [...document.images].filter((image) => !image.hasAttribute("alt")).length;
        const levels = [...document.querySelectorAll("main h1, main h2, main h3, main h4")].map((heading) => Number(heading.tagName.slice(1)));
        return { duplicateIds: ids.length - new Set(ids).size, imagesWithoutAlt, h1: levels.filter((level) => level === 1).length };
      });
      expect(structure).toEqual({ duplicateIds: 0, imagesWithoutAlt: 0, h1: 1 });
    }
    if (browserName === "chromium") {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
      await expectNoOverflow(page);
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/for-you/?visualTest=1");
  await capture(page, "after-for-you-mobile-sparse-390.png", ".r14-for-you-journey");
  await page.goto("/explore/?mode=personal&visualTest=1");
  await capture(page, "after-explore-mobile-personal-390.png", ".r14-explore-journey");
  expect(audit).toEqual({ console: [], page: [], http: [], external: [] });
});

test("R14-3L keyboard focus reaches every personal/relationship authority without traps", async ({ page }) => {
  const audit = runtimeAudit(page);
  await setState(page, { ...baseState, likedAlbumIds: [seedIds[0]], favoriteAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]] });
  for (const route of ["/", "/for-you/", "/albums/fantasy-jay-chou/", "/artists/artist-6452/", "/explore/?mode=genre&value=pop&kind=core", "/explore/?mode=personal", "/explore/?mode=random&seed=hardening"]) {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}visualTest=1`);
    for (let index = 0; index < 12; index += 1) await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const rect = element?.getBoundingClientRect();
      return { tag: element?.tagName ?? null, hidden: !rect || rect.width === 0 || rect.height === 0, body: element === document.body };
    });
    expect(focused.body).toBe(false);
    expect(focused.hidden).toBe(false);
  }
  expect(audit).toEqual({ console: [], page: [], http: [], external: [] });
});

test("R14-3L static no-JS documents retain factual archive structure", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  for (const route of ["/", "/for-you/", "/albums/fantasy-jay-chou/", "/artists/artist-6452/", "/explore/"]) {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main, [data-homepage-production]")).not.toHaveCount(0);
  }
  await context.close();
});

test("R14-3M machine-review generation captures deferred Home and For You states", async ({ page }) => {
  await setState(page, { ...baseState, likedAlbumIds: [seedIds[0]] });
  await page.goto("/?visualTest=1");
  await capture(page, "after-home-sparse-1440.png", ".r14-home-journey");
  await setState(page, { ...baseState, dismissedAlbumIds: seedIds, recommendationFeedback: Object.fromEntries(seedIds.map((id) => [id, "not_for_me"])) });
  await page.goto("/?visualTest=1");
  await capture(page, "after-home-negative-1440.png", ".r14-home-journey");
  await setState(page, { ...baseState, likedAlbumIds: [seedIds[0]], favoriteAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]], recentAlbumIds: seedIds });
  await page.goto("/for-you/?visualTest=1");
  await capture(page, "after-for-you-dense-1440.png", ".r14-for-you-journey");
});
