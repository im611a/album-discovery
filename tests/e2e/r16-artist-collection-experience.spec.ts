import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";
import { createInitialUserState } from "@/features/personal-state/schema";

import { settleVisual } from "./helpers/settled-visual";
import { resolveRegressionEvidenceRoot } from "./helpers/evidence-output";

const STORAGE_KEY = "album-discovery:user-state:v1";
const evidenceRoot = resolveRegressionEvidenceRoot({ phase: "r16-2c", environmentValue: process.env.R16_2C_EVIDENCE_ROOT });
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const dense = [...publishedArtists].sort((a, b) => b.albumCount - a.albumCount)[0]!;
const single = publishedArtists.find((artist) => artist.albumCount === 1)!;
const longArtist = [...publishedArtists].sort((a, b) => b.name.length - a.name.length)[0]!;
const sharedAlbum = catalogAlbums.find((album) => album.artists.length > 1)!;
const sharedArtists = sharedAlbum.artists.slice(0, 2).map((credit) => publishedArtists.find((artist) => artist.artistId === credit.id)!);
const routeFor = (artist: typeof dense, query = "") => `/artists/${artist.slug}/${query ? `?${query}` : ""}`;

type Runtime = { console: string[]; page: string[]; http: string[]; server: string[]; external: string[] };
type EvidenceCase = {
  caseId: string;
  artist: string;
  artistClass: string;
  route: string;
  viewport: { width: number; height: number; zoom: number };
  stateFixture: string;
  expectedIntersection: string;
  expectedCopy: string;
  navigationOrigin: string;
  filename: string;
  sha256: string;
  pixels: { width: number; height: number };
  checks: { horizontalOverflow: number; brokenImages: number };
};

function state(overrides: Record<string, unknown> = {}) {
  return { ...createInitialUserState(), updatedAt: "2026-08-13T00:00:00.000Z", ...overrides };
}

function watchRuntime(page: Page): Runtime {
  const runtime: Runtime = { console: [], page: [], http: [], server: [], external: [] };
  page.on("console", (message) => { if (message.type() === "error") runtime.console.push(message.text()); });
  page.on("pageerror", (error) => runtime.page.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) runtime.http.push(`${response.status()} ${response.url()}`);
    if (response.status() >= 500) runtime.server.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) runtime.external.push(request.url());
  });
  return runtime;
}

async function installState(page: Page, payload: unknown) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: payload });
}

async function settleArtist(page: Page, route: string) {
  await page.goto(route);
  await settleVisual(page, { route: new URL(route, "http://local").pathname, readySelector: ".r16-artist-collection, .r16-artist-collection-inline" });
  await expect(page.locator(".r16-artist-collection, .r16-artist-collection-inline")).toBeVisible();
  await expect.poll(() => page.locator("img").evaluateAll((images) => images.every((item) => {
    const image = item as HTMLImageElement;
    return image.complete && image.naturalWidth > 0;
  }))).toBe(true);
}

async function capture(page: Page, input: Omit<EvidenceCase, "filename" | "sha256" | "pixels" | "checks">, payload: unknown) {
  await page.setViewportSize({ width: input.viewport.width, height: input.viewport.height });
  await installState(page, payload);
  await settleArtist(page, input.route);
  if (input.viewport.zoom !== 1) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: input.viewport.zoom });
  }
  const measurement = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? 1 : 0,
    brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth <= 0).length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, parentClass: element.parentElement?.className, text: element.textContent?.slice(0, 120), rect: element.getBoundingClientRect().toJSON() })),
  }));
  expect(measurement.horizontalOverflow, JSON.stringify(measurement)).toBe(0);
  expect(measurement.brokenImages, JSON.stringify(measurement)).toBe(0);
  const checks = { horizontalOverflow: measurement.horizontalOverflow, brokenImages: measurement.brokenImages };
  const filename = `${input.caseId}.png`;
  const bytes = await page.screenshot({ path: path.join(screenshotRoot, filename), fullPage: true, animations: "disabled" });
  const result: EvidenceCase = {
    ...input,
    filename,
    sha256: sha256(bytes),
    pixels: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
    checks,
  };
  return result;
}

async function writeEvidence(cases: EvidenceCase[]) {
  const inventory = { schema: "r16-2c-visual-evidence/v1", qualification: "MACHINE_QUALIFIED_HUMAN_PENDING", cases };
  await writeFile(path.join(evidenceRoot, "R16_2C_SCREENSHOT_INVENTORY.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  const cards = [];
  for (const item of cases) {
    const bytes = await readFile(path.join(screenshotRoot, item.filename));
    expect(sha256(bytes)).toBe(item.sha256);
    cards.push(`<article><header><b>${item.caseId}</b><h2>${item.artist}</h2><p>${item.artistClass} · ${item.viewport.width}×${item.viewport.height} · ${item.viewport.zoom * 100}%</p></header><dl><dt>Route</dt><dd>${item.route}</dd><dt>State fixture</dt><dd>${item.stateFixture}</dd><dt>Expected intersection</dt><dd>${item.expectedIntersection}</dd><dt>Expected copy</dt><dd>${item.expectedCopy}</dd><dt>Navigation origin</dt><dd>${item.navigationOrigin}</dd><dt>SHA-256</dt><dd><code>${item.sha256}</code></dd></dl><img src="data:image/png;base64,${bytes.toString("base64")}" alt="${item.caseId} ${item.artist} visual evidence"></article>`);
  }
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R16-2C Human Quicklook</title><style>body{margin:0;background:#101010;color:#eee;font:15px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:36px 18px}h1{font:400 clamp(2.5rem,7vw,6rem)/1 Georgia,serif}aside{border-left:5px solid #ddd;padding:12px 20px;margin:30px 0;background:#1a1a1a}article{margin:54px 0 100px;border-top:1px solid #555;padding-top:22px}article header{display:flex;gap:20px;align-items:baseline;flex-wrap:wrap}h2{font:400 2rem Georgia,serif}dl{display:grid;grid-template-columns:180px 1fr;gap:7px 16px;margin:18px 0}dt{color:#999}dd{margin:0;overflow-wrap:anywhere}img{display:block;width:100%;height:auto;border:1px solid #444;background:#000}@media(max-width:600px){dl{grid-template-columns:1fr}dt{margin-top:8px}}</style></head><body><main><h1>R16-2C Artist ↔ Collection</h1><aside><strong>Human visual acceptance: PENDING</strong><p>这些是隔离的机器资格化证据。Quicklook 本身不授予人工验收，也不替代此前冻结证据。</p><p>${cases.length} cases · all PNG payloads embedded · generated from current R16-2C candidate.</p></aside>${cards.join("")}</main></body></html>`;
  await writeFile(path.join(evidenceRoot, "R16_2C_HUMAN_QUICKLOOK.html"), html);
}

test.describe("R16-2C visible Artist collection", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns R16-2C machine evidence.");

  test("captures real-catalog state and responsive cases into a self-contained Human Quicklook", async ({ page }) => {
    test.setTimeout(240_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime = watchRuntime(page);
    const first = dense.albumIds[0]!;
    const cases: Array<[Omit<EvidenceCase, "filename" | "sha256" | "pixels" | "checks">, unknown]> = [
      [{ caseId: "01-single-zero-1440", artist: single.name, artistClass: "single / zero", route: routeFor(single), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "empty", expectedIntersection: "0 kept", expectedCopy: "当前设备还没有保留", navigationOrigin: "DIRECT" }, state()],
      [{ caseId: "02-single-retained-1440", artist: single.name, artistClass: "single / retained", route: routeFor(single), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "favorite", expectedIntersection: "1 kept / favorite", expectedCopy: "收藏", navigationOrigin: "DIRECT" }, state({ favoriteAlbumIds: single.albumIds })],
      [{ caseId: "03-single-recent-390", artist: single.name, artistClass: "single / recent", route: routeFor(single), viewport: { width: 390, height: 844, zoom: 1 }, stateFixture: "recent only", expectedIntersection: "0 kept / 1 viewed", expectedCopy: "最近查看", navigationOrigin: "DIRECT" }, state({ recentAlbumIds: single.albumIds })],
      [{ caseId: "04-multi-zero-1440", artist: dense.name, artistClass: "multi / zero", route: routeFor(dense), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "empty", expectedIntersection: "0 kept", expectedCopy: "当前设备还没有保留", navigationOrigin: "DIRECT" }, state()],
      [{ caseId: "05-multi-one-1440", artist: dense.name, artistClass: "multi / one retained", route: routeFor(dense), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "saved one", expectedIntersection: "1 kept", expectedCopy: "想听 1 张", navigationOrigin: "DIRECT" }, state({ savedAlbumIds: [first] })],
      [{ caseId: "06-multi-several-1440", artist: dense.name, artistClass: "multi / several retained", route: routeFor(dense), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "favorite four", expectedIntersection: "4 kept", expectedCopy: "收藏 4 张", navigationOrigin: "DIRECT" }, state({ favoriteAlbumIds: dense.albumIds.slice(0, 4) })],
      [{ caseId: "07-multi-mixed-1440", artist: dense.name, artistClass: "multi / mixed", route: routeFor(dense), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "saved + liked + favorite + listened", expectedIntersection: "5 kept / mixed", expectedCopy: "bounded nonzero counts", navigationOrigin: "DIRECT" }, state({ savedAlbumIds: dense.albumIds.slice(0, 2), likedAlbumIds: dense.albumIds.slice(2, 3), favoriteAlbumIds: dense.albumIds.slice(3, 4), listenedAlbumIds: dense.albumIds.slice(4, 5) })],
      [{ caseId: "08-multi-negative-1440", artist: dense.name, artistClass: "multi / negative", route: routeFor(dense), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "dismissed one", expectedIntersection: "0 positive / 1 explicit negative", expectedCopy: "不适合我", navigationOrigin: "DIRECT" }, state({ dismissedAlbumIds: [first], recommendationFeedback: { [first]: "not_for_me" } })],
      [{ caseId: "09-multi-recent-1440", artist: dense.name, artistClass: "multi / recent only", route: routeFor(dense), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "recent three", expectedIntersection: "0 kept / 3 viewed", expectedCopy: "最近查看过 3 张", navigationOrigin: "DIRECT" }, state({ recentAlbumIds: dense.albumIds.slice(0, 3) })],
      [{ caseId: "10-shared-credit-1440", artist: sharedArtists[0]!.name, artistClass: "multi-credit Album", route: routeFor(sharedArtists[0]!), viewport: { width: 1440, height: 900, zoom: 1 }, stateFixture: "shared favorite", expectedIntersection: "canonical shared Album retained", expectedCopy: "收藏 1 张", navigationOrigin: "DIRECT" }, state({ favoriteAlbumIds: [sharedAlbum.id] })],
      [{ caseId: "11-long-artist-1280", artist: longArtist.name, artistClass: "long Artist / mixed text", route: routeFor(longArtist), viewport: { width: 1280, height: 900, zoom: 1 }, stateFixture: "first saved", expectedIntersection: "1 kept", expectedCopy: "想听 1 张", navigationOrigin: "DIRECT" }, state({ savedAlbumIds: [longArtist.albumIds[0]!] })],
      ...([390, 768, 1024, 1280, 1440, 2048] as const).map((width, index): [Omit<EvidenceCase, "filename" | "sha256" | "pixels" | "checks">, unknown] => [{ caseId: `${12 + index}-dense-responsive-${width}`, artist: dense.name, artistClass: "dense / mixed / responsive", route: routeFor(dense, "lfrom=library&lview=favorite&entry=explore&pfrom=for-you"), viewport: { width, height: width === 390 ? 844 : 900, zoom: 1 }, stateFixture: "mixed dense", expectedIntersection: "5 kept / mixed", expectedCopy: "collection remains secondary", navigationOrigin: "LIBRARY + independent discovery/personal", }, state({ savedAlbumIds: dense.albumIds.slice(0, 2), favoriteAlbumIds: dense.albumIds.slice(2, 5), recentAlbumIds: dense.albumIds.slice(0, 2) })]),
      [{ caseId: "18-dense-200-percent", artist: dense.name, artistClass: "dense / zoom", route: routeFor(dense), viewport: { width: 1280, height: 900, zoom: 2 }, stateFixture: "mixed dense", expectedIntersection: "5 kept / mixed", expectedCopy: "no clipping at 200%", navigationOrigin: "DIRECT" }, state({ savedAlbumIds: dense.albumIds.slice(0, 2), favoriteAlbumIds: dense.albumIds.slice(2, 5) })],
    ];
    const captured: EvidenceCase[] = [];
    for (const [item, payload] of cases) captured.push(await capture(page, item, payload));
    await writeEvidence(captured);
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
  });

  test("settles positive, listened and negative mutations with reload persistence", async ({ page }) => {
    const runtime = watchRuntime(page);
    const albumId = dense.albumIds[0]!;
    const album = catalogAlbums.find((candidate) => candidate.id === albumId)!;
    await installState(page, state());
    await settleArtist(page, routeFor(dense));
    const row = page.locator(".r12-discography__release").filter({ has: page.locator(`a[href^="/albums/${album.slug}"]`) }).first();
    await row.getByText("本机状态").click();
    await row.getByRole("button", { name: "想听" }).click();
    await expect(page.locator("[data-metric=saved] dd")).toHaveText("1 张");
    await row.getByRole("button", { name: "收藏" }).click();
    await expect(page.locator("[data-metric=favorite] dd")).toHaveText("1 张");
    await page.reload(); await settleVisual(page, { route: new URL(page.url()).pathname, readySelector: ".r16-artist-collection" });
    await expect(page.locator(`[data-album-id="${albumId}"][data-state=favorite]`)).toBeVisible();
    const reloaded = page.locator(".r12-discography__release").filter({ has: page.locator(`a[href^="/albums/${album.slug}"]`) }).first();
    await reloaded.getByText("本机状态").click();
    await reloaded.getByRole("button", { name: "听过" }).click();
    await expect(page.locator("[data-metric=listened] dd")).toHaveText("1 张");
    await reloaded.getByRole("button", { name: "不适合我" }).click();
    await expect(page.locator(`[data-album-id="${albumId}"][data-state=dismissed]`)).toBeVisible();
    await expect(page.locator("[data-metric=kept]")).toHaveCount(0);
    await reloaded.getByRole("button", { name: "撤销不适合" }).click();
    await expect(page.locator(`[data-album-id="${albumId}"][data-state=marked_listened]`)).toBeVisible();
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
  });

  test("preserves return and discovery journeys without provenance growth", async ({ page }) => {
    const runtime = watchRuntime(page);
    await installState(page, state({ favoriteAlbumIds: dense.albumIds.slice(0, 2) }));
    const query = "lfrom=library&lview=favorite&entry=explore&trail=wake-after-the-rain&via=SHARED_ARTIST&pfrom=for-you";
    await settleArtist(page, routeFor(dense, query));
    await expect(page.locator("[data-navigation-origin=library]")).toBeVisible();
    if (await page.locator(".r16-artist-collection__index a").count() === 0) {
      const row = page.locator(".r12-discography__release").first();
      await row.getByText("本机状态").click();
      await row.getByRole("button", { name: "收藏" }).click();
    }
    const work = page.locator(".r16-artist-collection__index a").first();
    const href = await work.getAttribute("href");
    expect(href).toContain("lfrom=library"); expect(href).toContain("entry=explore"); expect(href).toContain("pfrom=for-you");
    await work.click();
    await expect(page.locator("[data-navigation-origin=library]")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".r16-artist-collection")).toBeVisible();
    await page.goto(routeFor(dense, "sfrom=search&sq=test"));
    await expect(page.locator("[data-navigation-origin=search]")).toBeVisible();
    await page.goto(routeFor(dense));
    await expect(page.locator(".r15-return-journey")).toHaveCount(0);
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
  });

  test("shares one Album state across credited Artists and remains keyboard/zoom safe", async ({ page }) => {
    const runtime = watchRuntime(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await installState(page, state());
    await settleArtist(page, routeFor(sharedArtists[0]!));
    const sharedRow = page.locator(".r12-discography__release").filter({ has: page.locator(`a[href^="/albums/${sharedAlbum.slug}"]`) }).first();
    await sharedRow.getByText("本机状态").click();
    await sharedRow.getByRole("button", { name: "收藏" }).click();
    await settleArtist(page, routeFor(sharedArtists[1]!));
    await expect(page.getByText(/本机专辑中有 1 张来自/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(/本机专辑中有 1 张来自/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const action = page.locator(".album-actions--compact > summary").first(); await action.focus(); await expect(action).toBeFocused();
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
  });
});
