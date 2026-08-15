import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";
import { createInitialUserState } from "@/features/personal-state/schema";
import { resolveRegressionEvidenceRoot } from "./helpers/evidence-output";
import { settleVisual } from "./helpers/settled-visual";

const STORAGE_KEY = "album-discovery:user-state:v1";
const evidenceRoot = resolveRegressionEvidenceRoot({ phase: "r17-candidate", environmentValue: process.env.R17_EVIDENCE_ROOT });
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const albums = catalogAlbums;
const primaryAlbum = albums[0]!;
const denseArtist = [...publishedArtists].sort((a, b) => b.albumCount - a.albumCount)[0]!;
const longAlbum = [...albums].sort((a, b) => (b.title.length + b.artists.map((item) => item.name).join("、").length) - (a.title.length + a.artists.map((item) => item.name).join("、").length))[0]!;

type Runtime = { console: string[]; page: string[]; http: string[]; server: string[]; external: string[] };
type EvidenceCase = {
  caseId: string;
  group: string;
  title: string;
  origin: string;
  destination: string;
  route: string;
  expectedBehavior: string;
  stateFixture: string;
  viewport: { width: number; height: number; zoom: number };
  capture: "PAGE" | "LIBRARY" | "HOME_RAIL";
  filename: string;
  sha256: string;
  pixels: { width: number; height: number };
  checks: { horizontalOverflow: number; brokenImages: number };
  humanDecision: "PENDING";
  reviewerNote: "";
};
type CaseInput = Omit<EvidenceCase, "filename" | "sha256" | "pixels" | "checks" | "humanDecision" | "reviewerNote"> & { payload: unknown };

function state(overrides: Record<string, unknown> = {}) {
  return { ...createInitialUserState(), updatedAt: "2026-08-14T12:00:00.000Z", ...overrides };
}

function watch(page: Page): Runtime {
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

async function prime(page: Page, payload: unknown) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(payload) });
}

async function captureCase(browser: Browser, input: CaseInput, aggregate: Runtime): Promise<EvidenceCase> {
  const cssViewport = {
    width: Math.round(input.viewport.width / input.viewport.zoom),
    height: Math.round(input.viewport.height / input.viewport.zoom),
  };
  const context = await browser.newContext({
    viewport: cssViewport,
    deviceScaleFactor: input.viewport.zoom,
    colorScheme: "dark",
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const runtime = watch(page);
  await prime(page, input.payload);
  try {
    await page.goto(input.route);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" });
    const readySelector = input.capture === "LIBRARY" ? ".r15-library-experience" : input.capture === "HOME_RAIL" ? ".r17-recent-return" : ".album-detail";
    await settleVisual(page, { route: new URL(input.route, "http://local").pathname, readySelector });
    const checks = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? 1 : 0,
      brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth <= 0).length,
    }));
    expect(checks).toEqual({ horizontalOverflow: 0, brokenImages: 0 });
    if (input.capture === "HOME_RAIL") {
      await page.locator(".r17-recent-return").evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
    }
    if (input.capture === "LIBRARY") {
      const recentHeading = page.locator(".r15-library-recent .r15-library-section-heading");
      const emptyState = page.locator(".r15-library-empty").last();
      const target = await recentHeading.count() ? recentHeading : emptyState;
      await target.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" }));
      await page.evaluate(() => window.scrollBy(0, -24));
    }
    if (input.caseId === "29-zoom-200") {
      await expect(page.locator(".r17-return-journey")).toBeInViewport();
      await expect(page.locator(".album-detail__intro > h1")).toBeInViewport();
    }
    const filename = `${input.caseId}.png`;
    const target = path.join(screenshotRoot, filename);
    const bytes = await page.screenshot({ path: target, animations: "disabled", fullPage: false, scale: "device" });
    const { payload: _payload, ...record } = input;
    void _payload;
    const pixels = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    expect(pixels).toEqual({ width: input.viewport.width, height: input.viewport.height });
    return { ...record, filename, sha256: sha256(bytes), pixels, checks, humanDecision: "PENDING", reviewerNote: "" };
  } finally {
    for (const key of Object.keys(aggregate) as Array<keyof Runtime>) aggregate[key].push(...runtime[key]);
    await context.close();
  }
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function writeEvidence(cases: EvidenceCase[], runtime: Runtime) {
  const inventory = { schema: "r17-visual-candidate/v1", qualification: "MACHINE_QUALIFIED_HUMAN_PENDING", humanAcceptance: "PENDING", cases };
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
  await writeFile(path.join(evidenceRoot, "R17_SCREENSHOT_INVENTORY.json"), inventoryText);
  let payloadMismatch = 0;
  const cards: string[] = [];
  for (const item of cases) {
    const bytes = await readFile(path.join(screenshotRoot, item.filename));
    if (sha256(bytes) !== item.sha256) payloadMismatch += 1;
    const encoded = bytes.toString("base64");
    if (sha256(Buffer.from(encoded, "base64")) !== item.sha256) payloadMismatch += 1;
    cards.push(`<article data-case-id="${item.caseId}"><header><b>${item.caseId}</b><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.group)} · ${item.viewport.width}×${item.viewport.height} · ${item.viewport.zoom * 100}%</p></header><dl><dt>Origin</dt><dd>${escapeHtml(item.origin)}</dd><dt>Destination</dt><dd>${escapeHtml(item.destination)}</dd><dt>Route</dt><dd><code>${escapeHtml(item.route)}</code></dd><dt>Expected behavior</dt><dd>${escapeHtml(item.expectedBehavior)}</dd><dt>State</dt><dd>${escapeHtml(item.stateFixture)}</dd><dt>Image SHA-256</dt><dd><code>${item.sha256}</code></dd><dt>Human decision</dt><dd>PENDING ☐ Accept ☐ Reject</dd><dt>Reviewer note</dt><dd>________________________________</dd></dl><img src="data:image/png;base64,${encoded}" alt="${escapeHtml(item.caseId + " " + item.title)}"></article>`);
  }
  expect(payloadMismatch).toBe(0);
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R17 Human Quicklook</title><style>body{margin:0;background:#0d0d0d;color:#eee;font:15px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:36px 18px}h1{font:400 clamp(2.5rem,7vw,6rem)/1 Georgia,serif}aside{border-left:5px solid #ddd;padding:12px 20px;margin:30px 0;background:#191919}article{margin:54px 0 100px;border-top:1px solid #555;padding-top:22px}article header{display:flex;gap:20px;align-items:baseline;flex-wrap:wrap}h2{font:400 2rem Georgia,serif}dl{display:grid;grid-template-columns:180px 1fr;gap:7px 16px;margin:18px 0}dt{color:#999}dd{margin:0;overflow-wrap:anywhere}img{display:block;width:100%;height:auto;border:1px solid #444;background:#000}@media(max-width:600px){dl{grid-template-columns:1fr}dt{margin-top:8px}}</style></head><body><main><h1>R17 Recent-view Return Journey</h1><aside><strong>Human visual acceptance: PENDING</strong><p>${cases.length} 个隔离机器资格化案例，所有人工决定均未勾选。本文件不自动授予人工验收，也不是已接受 evidence baseline。</p><p>Inventory SHA-256: <code>${sha256(inventoryText)}</code> · standalone/embedded mismatch: 0.</p></aside>${cards.join("")}</main></body></html>`;
  await writeFile(path.join(evidenceRoot, "R17_HUMAN_QUICKLOOK.html"), html);
  await writeFile(path.join(evidenceRoot, "R17_VISUAL_MACHINE_SUMMARY.json"), `${JSON.stringify({ cases: cases.length, pngs: cases.length, embeddedImages: cases.length, payloadMismatch, runtime, humanAcceptance: "PENDING" }, null, 2)}\n`);
}

test.describe("R17 recent-view return journey", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns R17 candidate evidence.");

  test("captures 29 isolated human-review cases", async ({ browser }) => {
    test.setTimeout(600_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime: Runtime = { console: [], page: [], http: [], server: [], external: [] };
    const ids = albums.map((album) => album.id);
    const empty = state();
    const sparse = state({ recentAlbumIds: ids.slice(0, 3) });
    const dense = state({ recentAlbumIds: ids.slice(0, 20), savedAlbumIds: ids.slice(0, 4), favoriteAlbumIds: ids.slice(4, 7) });
    const album = albums[0]!;
    const artistAlbum = albums.find((item) => item.artists.some((credit) => credit.id === denseArtist.artistId))!;
    const c = (caseId: string, group: string, title: string, origin: string, destination: string, route: string, payload: unknown, stateFixture: string, expectedBehavior: string, width = 1440, height = 900, zoom = 1, capture: CaseInput["capture"] = "PAGE"): CaseInput => ({ caseId, group, title, origin, destination, route, payload, stateFixture, expectedBehavior, viewport: { width, height, zoom }, capture });
    const albumRoute = (query = "") => `/albums/${album.slug}${query ? `?${query}` : ""}`;
    const artistRoute = (query = "") => `/albums/${artistAlbum.slug}?entry=artist&entryKey=${denseArtist.slug}${query ? `&${query}` : ""}`;
    const cases: CaseInput[] = [
      c("01-library-empty", "A Library Recent", "Library recent · empty", "LIBRARY_RECENT", "Library", "/library?view=recent", empty, "EMPTY", "Intentional empty state; no fabricated Albums", 1440, 900, 1, "LIBRARY"),
      c("02-library-sparse", "A Library Recent", "Library recent · sparse", "LIBRARY_RECENT", "Library", "/library?view=recent", sparse, "3 recent", "Three canonical Albums in recency order", 1440, 900, 1, "LIBRARY"),
      c("03-library-dense", "A Library Recent", "Library recent · dense", "LIBRARY_RECENT", "Library", "/library?view=recent", dense, "20 recent", "Bounded, decoded and duplicate-free recent grid", 1440, 900, 1, "LIBRARY"),
      c("04-library-selected", "A Library Recent", "Library recent · active facet", "LIBRARY_RECENT", "Library", "/library?view=recent&q=a", dense, "dense + query", "Active category and truthful filtered count", 1440, 900, 1, "LIBRARY"),
      c("05-album-from-recent", "B Album Return", "Album from Library Recent", "LIBRARY_RECENT", "Album", albumRoute("lfrom=library&lview=recent"), sparse, "3 recent", "Explicit return to Recent is visible"),
      c("06-return-to-recent", "B Album Return", "Returned Library Recent", "ALBUM_RETURN", "Library Recent", "/library?view=recent", sparse, "3 recent", "Return destination restores recent category", 1440, 900, 1, "LIBRARY"),
      c("07-artist-chronology", "C Artist Continuity", "Artist chronology → Album", "ARTIST_DISCOGRAPHY", "Album", artistRoute(), sparse, "3 recent", "Return points to canonical Artist chronology"),
      c("08-artist-personal", "C Artist Continuity", "Artist personal continuation → Album", "ARTIST_PERSONAL_CONTINUATION", "Album", artistRoute("pfrom=artist"), dense, "dense", "Personal origin remains distinct and returns to Artist"),
      c("09-artist-relation", "C Artist Continuity", "Artist relation continuation → Album", "ARTIST_RELATION", "Album", artistRoute("via=SHARED_ARTIST"), sparse, "sparse", "Relation trail remains bounded; return is Artist"),
      c("10-search-return", "D Search Continuity", "Search → Album", "SEARCH_RESULT", "Album", albumRoute("sfrom=search&sq=ambient&spage=2"), sparse, "sparse", "Query and page return are visible"),
      c("11-explore-relation", "E Explore Continuity", "Explore relation → Album", "EXPLORE_RELATION", "Album", albumRoute("entry=explore&via=PRIMARY_SAME_ERA"), sparse, "sparse", "Explore origin is not reinterpreted as personal"),
      c("12-explore-personal", "E Explore Continuity", "Explore personal → Album", "EXPLORE_PERSONAL", "Album", albumRoute("entry=explore&pfrom=explore"), dense, "dense", "Current-device personal Explore return is explicit"),
      c("13-explore-serendipity", "E Explore Continuity", "Explore serendipity → Album", "EXPLORE_SERENDIPITY", "Album", albumRoute("entry=explore"), sparse, "sparse", "Return copy makes no personal or relation claim"),
      c("14-direct-deep-link", "G Empty / Edge", "Direct Album deep link", "DIRECT", "Album", albumRoute(), empty, "empty", "No fabricated explicit return context"),
      c("15-repeated-album", "G Empty / Edge", "Repeated recent Album", "LIBRARY_RECENT", "Album", albumRoute("lfrom=library&lview=recent"), state({ recentAlbumIds: [album.id, ids[1], album.id] }), "duplicate input", "One recent identity; repeated visit remains first"),
      c("16-long-metadata", "G Empty / Edge", "Long title and multi-credit", "LIBRARY_RECENT", "Album", `/albums/${longAlbum.slug}?lfrom=library&lview=recent`, state({ ...dense, recentAlbumIds: [longAlbum.id, ...ids.filter((id) => id !== longAlbum.id).slice(0, 19)] }), "dense / target already first", "Long identity wraps without overflow"),
      c("17-mobile-library-empty", "F Mobile", "390 · Library empty", "LIBRARY_RECENT", "Library", "/library?view=recent", empty, "empty", "Finger-readable intentional empty state", 390, 844, 1, "LIBRARY"),
      c("18-mobile-library", "F Mobile", "390 · Library populated", "LIBRARY_RECENT", "Library", "/library?view=recent", dense, "dense", "Covers and identity remain readable", 390, 844, 1, "LIBRARY"),
      c("19-mobile-album-return", "F Mobile", "390 · Album return", "LIBRARY_RECENT", "Album", albumRoute("lfrom=library&lview=recent"), sparse, "sparse", "Return affordance remains readable", 390, 844),
      c("20-mobile-search", "F Mobile", "430 · Search return", "SEARCH_RESULT", "Album", albumRoute("sfrom=search&sq=ambient"), sparse, "sparse", "Search return is finger-accessible", 430, 860),
      c("21-mobile-artist", "F Mobile", "430 · Artist return", "ARTIST_DISCOGRAPHY", "Album", artistRoute(), sparse, "sparse", "Artist return wraps clearly", 430, 860),
      c("22-mobile-explore", "F Mobile", "430 · Explore return", "EXPLORE_PERSONAL", "Album", albumRoute("entry=explore&pfrom=explore"), sparse, "sparse", "Explore authority remains understandable", 430, 860),
      c("23-responsive-768", "F Responsive", "768 · Library Recent", "LIBRARY_RECENT", "Library", "/library?view=recent", dense, "dense", "No overflow at tablet boundary", 768, 900, 1, "LIBRARY"),
      c("24-responsive-1024", "F Responsive", "1024 · Album return", "SEARCH_RESULT", "Album", albumRoute("sfrom=search&sq=ambient"), sparse, "sparse", "Editorial hierarchy remains stable", 1024, 900),
      c("25-home-recent-1280", "A Library Recent", "Home compact recent-return rail", "HOME", "Recent return", "/", dense, "dense", "Return rail remains subordinate to Home editorial hierarchy", 1280, 900, 1, "HOME_RAIL"),
      c("26-responsive-1440", "F Responsive", "1440 · Album return", "ARTIST_DISCOGRAPHY", "Album", artistRoute(), dense, "dense", "Desktop return context is restrained", 1440, 900),
      c("27-responsive-2048", "F Responsive", "2048 · Library Recent", "LIBRARY_RECENT", "Library", "/library?view=recent", dense, "dense", "Archive composition remains bounded", 2048, 1100, 1, "LIBRARY"),
      c("28-responsive-390", "F Responsive", "390 · Direct Album", "DIRECT", "Album", albumRoute(), empty, "empty", "Direct entry has no false origin or overflow", 390, 844),
      c("29-zoom-200", "F Accessibility", "200% zoom · Album return", "LIBRARY_RECENT", "Album", albumRoute("lfrom=library&lview=recent"), sparse, "sparse", "Return link and Album identity remain usable at 200%", 1280, 900, 2),
    ];
    expect(cases).toHaveLength(29);
    const captured: EvidenceCase[] = [];
    for (const item of cases) captured.push(await captureCase(browser, item, runtime));
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
    await writeEvidence(captured, runtime);
  });

  test("executes settled Library, Artist, Search, Explore and history journeys", async ({ page }) => {
    test.setTimeout(180_000);
    const runtime = watch(page);
    await prime(page, state({ recentAlbumIds: albums.slice(0, 4).map((item) => item.id) }));
    await page.goto("/library?view=recent");
    await settleVisual(page, { route: "/library", readySelector: ".r15-library-experience" });
    await page.locator(".r15-library-recent-record__cover").first().click();
    await expect(page.locator('[data-navigation-origin="library_recent"]')).toBeVisible();
    await page.getByRole("link", { name: /返回最近查看/ }).click();
    await expect(page.locator('[data-library-view="recent"]')).toBeVisible();

    await page.goto(`/artists/${denseArtist.slug}`);
    await settleVisual(page, { route: new RegExp(`/artists/${denseArtist.slug}`), readySelector: ".r16-artist-collection" });
    await page.locator(".r12-discography__release h4 a").first().click();
    await expect(page.locator('[data-navigation-origin="artist_discography"]')).toBeVisible();
    await page.goBack();
    await page.goForward();
    await expect(page.locator('[data-navigation-origin="artist_discography"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-navigation-origin="artist_discography"]')).toBeVisible();

    await page.goto(`/search?q=${encodeURIComponent(primaryAlbum.artists[0]!.name)}`);
    await page.locator(".search-album-results a").first().click();
    await expect(page.locator('[data-navigation-origin="search_result"]')).toBeVisible();

    await page.goto("/explore?mode=random&seed=12345");
    await page.locator(".r13-explore-entry__primary").click();
    await expect(page.locator('[data-navigation-origin="explore"]')).toBeVisible();

    await page.goto(`/albums/${primaryAlbum.slug}`);
    await expect(page.locator(".r17-return-journey")).toHaveCount(0);
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
  });
});
