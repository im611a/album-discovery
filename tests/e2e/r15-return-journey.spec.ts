import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { catalogAlbums } from "@/catalog/published-catalog";
import { settleVisual } from "./helpers/settled-visual";
import { resolveRegressionEvidenceRoot } from "./helpers/evidence-output";

const STORAGE_KEY = "album-discovery:user-state:v1";
const repoRoot = path.resolve(process.env.R15_REPO_ROOT ?? ".");
const evidenceRoot = resolveRegressionEvidenceRoot({ phase: "r15-2g", environmentValue: process.env.R15_2G_EVIDENCE_ROOT, repoRoot });
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const frozen2cRoot = path.join(repoRoot, ".local-data/r15-product-evolution/r15-2c-visible-library");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const primary = catalogAlbums[0]!;
const secondary = catalogAlbums.find((album) => album.id !== primary.id)!;
const searchAlbum = catalogAlbums.find((album) => album.artists.some((artist) => artist.name.includes("王菲"))) ?? primary;
const longTitleAlbum = catalogAlbums.reduce((longest, album) => album.title.length > longest.title.length ? album : longest, primary);
const multiArtistAlbum = catalogAlbums.reduce((most, album) => album.artists.length > most.artists.length ? album : most, primary);

type Audit = { console: string[]; page: string[]; http: string[]; external: string[] };
type Capture = {
  caseId: string;
  filename: string;
  route: string;
  description: string;
  origin: string;
  provenance: string;
  viewport: { width: number; height: number; zoom: number };
  pixels: { width: number; height: number };
  sha256: string;
  checks: { horizontalOverflow: number; brokenImages: number; remoteImages: number; duplicateReturnAffordances: number };
};
const audits = new WeakMap<Page, Audit>();
const captures: Capture[] = [];

function state(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    taste: { genres: [], descriptors: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" },
    likedAlbumIds: [primary.id],
    favoriteAlbumIds: [primary.id, secondary.id],
    savedAlbumIds: [primary.id, secondary.id, searchAlbum.id],
    listenedAlbumIds: [secondary.id],
    dismissedAlbumIds: [],
    recommendationFeedback: {},
    recentAlbumIds: [primary.id, secondary.id],
    onboardingCompleted: true,
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

async function installState(page: Page, payload = state()) {
  await page.goto("/library/?r15ReturnSetup=1");
  await expect(page.locator("[data-library-ready=true]")).toBeVisible();
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: payload });
}

async function verifyFrozen2c() {
  const inventoryPath = path.join(frozen2cRoot, "R15_2C_SCREENSHOT_INVENTORY.json");
  const inventoryBytes = await readFile(inventoryPath);
  const inventory = JSON.parse(inventoryBytes.toString()) as { cases: Array<{ filename: string; sha256: string }> };
  expect(inventory.cases).toHaveLength(18);
  const files = [];
  for (const item of inventory.cases) {
    const bytes = await readFile(path.join(frozen2cRoot, "screenshots", item.filename));
    expect(sha256(bytes), `frozen R15-2C screenshot ${item.filename}`).toBe(item.sha256);
    files.push({ path: `screenshots/${item.filename}`, sha256: item.sha256 });
  }
  const quicklook = await readFile(path.join(frozen2cRoot, "R15_2C_HUMAN_QUICKLOOK.html"));
  const manifest = {
    schema: "r15-2c-frozen-evidence/v1",
    decision: "ACCEPTED",
    acceptedEvidenceCount: 18,
    inventory: { path: "R15_2C_SCREENSHOT_INVENTORY.json", sha256: sha256(inventoryBytes) },
    quicklook: { path: "R15_2C_HUMAN_QUICKLOOK.html", sha256: sha256(quicklook) },
    files,
    overwritePolicy: "PROHIBITED",
  };
  await writeFile(path.join(frozen2cRoot, "R15_2C_FROZEN_EVIDENCE_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

test.beforeEach(async ({ page }) => {
  const audit: Audit = { console: [], page: [], http: [], external: [] };
  audits.set(page, audit);
  page.on("console", (message) => { if (message.type() === "error") audit.console.push(message.text()); });
  page.on("pageerror", (error) => audit.page.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) audit.http.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") audit.external.push(request.url());
  });
});

test.afterEach(async ({ page }) => {
  expect(audits.get(page)).toEqual({ console: [], page: [], http: [], external: [] });
});

test("R15-2D Library origin survives Album, relation continuation, mutation and return", async ({ page }) => {
  await installState(page);
  const q = primary.title.slice(0, 12);
  await page.goto(`/library/?view=saved&q=${encodeURIComponent(q)}&sort=title`);
  await expect(page.locator("[data-library-ready=true]")).toBeVisible();
  await page.locator("[data-library-album] .r15-library-record__cover").first().click();
  await expect(page.locator("[data-navigation-origin=library]")).toBeVisible();
  expect(page.url()).toContain("lfrom=library");
  expect(page.url()).toContain("lq=");
  const returnHref = await page.getByRole("link", { name: /返回我的专辑/ }).getAttribute("href");
  expect(returnHref).toContain("view=saved");
  expect(returnHref).toContain("sort=title");
  await page.getByRole("button", { name: /已想听|想听/ }).first().click();
  await page.locator(".r13-discovery__primary").click();
  await expect(page.locator("[data-navigation-origin=library]")).toBeVisible();
  expect(page.url()).toContain("lfrom=library");
  await page.getByRole("link", { name: /返回我的专辑/ }).click();
  await expect(page.locator("[data-library-ready=true]")).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/\/library\/?$/);
});

test("R15-2E Search origin survives Album, Artist and discovery while direct routes stay neutral", async ({ page }) => {
  await installState(page);
  await page.goto(`/search/?q=${encodeURIComponent("王菲")}`);
  const albumLink = page.locator(".compact-album-row__cover").first();
  await expect(albumLink).toHaveAttribute("href", /sfrom=search/);
  await albumLink.click();
  await expect(page.locator("[data-navigation-origin=search]")).toBeVisible();
  await page.locator(".r13-discovery__primary").click();
  await expect(page.locator("[data-navigation-origin=search]")).toBeVisible();
  await page.getByRole("link", { name: /返回搜索结果/ }).click();
  await expect(page.getByRole("search")).toBeVisible();
  await page.goto(`/artists/artist-${searchAlbum.artists[0]!.neteaseArtistId}?sfrom=search&sq=${encodeURIComponent("王菲")}`);
  await expect(page.locator("[data-navigation-origin=search]")).toBeVisible();
  await page.goto(`/albums/${primary.slug}/`);
  await expect(page.locator(".r15-return-journey")).toHaveCount(0);
});

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function capture(page: Page, item: Omit<Capture, "pixels" | "sha256" | "checks">) {
  await page.setViewportSize({ width: item.viewport.width, height: item.viewport.height });
  const albumSlug = new URL(item.route, "http://local").pathname.match(/^\/albums\/([^/]+)/)?.[1];
  const albumId = albumSlug ? catalogAlbums.find((album) => album.slug === albumSlug)?.id : null;
  const stableRecent = albumId ? [albumId, primary.id, secondary.id].filter((id, index, values) => values.indexOf(id) === index) : [primary.id, secondary.id];
  await installState(page, item.caseId === "04" ? state({ savedAlbumIds: [secondary.id] }) : state({ recentAlbumIds: stableRecent }));
  await page.goto(item.route);
  await settleVisual(page, { route: new URL(item.route, "http://local").pathname, readySelector: "main h1" });
  if (item.viewport.zoom !== 1) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: item.viewport.zoom });
  }
  const checks = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? 1 : 0,
    brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth <= 0).length,
    remoteImages: [...document.images].filter((image) => new URL(image.currentSrc, location.href).origin !== location.origin).length,
    duplicateReturnAffordances: Math.max(0, document.querySelectorAll(".r15-return-journey").length - 1),
  }));
  expect(checks).toEqual({ horizontalOverflow: 0, brokenImages: 0, remoteImages: 0, duplicateReturnAffordances: 0 });
  const target = path.join(screenshotRoot, item.filename);
  await page.screenshot({ path: target, fullPage: true, animations: "disabled" });
  const bytes = await readFile(target);
  captures.push({ ...item, pixels: pngDimensions(bytes), sha256: sha256(bytes), checks });
  if (item.viewport.zoom !== 1) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  }
}

test("R15-2G captures only newly introduced return-journey behavior", async ({ page }) => {
  test.setTimeout(240_000);
  await page.clock.install({ time: new Date("2026-08-13T12:00:00.000Z") });
  await mkdir(screenshotRoot, { recursive: true });
  await verifyFrozen2c();
  const library = `lfrom=library&lview=favorite&lq=${encodeURIComponent("ambient")}&lsort=title`;
  const search = `sfrom=search&sq=${encodeURIComponent("王菲")}`;
  const cases: Array<Omit<Capture, "pixels" | "sha256" | "checks">> = [
    ["01", "01-library-album-desktop.png", `/albums/${primary.slug}/?${library}`, "Library → Album return affordance desktop", "LIBRARY", "COLLECTION", 1440, 950, 1],
    ["02", "02-library-album-mobile.png", `/albums/${primary.slug}/?${library}`, "Library → Album return affordance mobile", "LIBRARY", "COLLECTION", 390, 844, 1],
    ["03", "03-library-second-album.png", `/albums/${secondary.slug}/?entry=album&trail=${primary.slug}&via=artist&${library}`, "Second Album preserves Library context", "LIBRARY", "RELATION", 1280, 900, 1],
    ["04", "04-library-after-mutation.png", `/library/?view=saved`, "Library-origin mutation reconciled on return", "LIBRARY", "LOCAL_STATE", 1280, 900, 1],
    ["05", "05-library-facet-preserved.png", `/albums/${primary.slug}/?lfrom=library&lview=favorite`, "Library facet context preserved", "LIBRARY", "COLLECTION", 1024, 900, 1],
    ["06", "06-library-query-preserved.png", `/albums/${primary.slug}/?lfrom=library&lview=all&lq=${encodeURIComponent(primary.title.slice(0, 12))}&lsort=release-newest`, "Library search and sort context preserved", "LIBRARY", "COLLECTION", 1440, 950, 1],
    ["07", "07-search-results-baseline.png", `/search/?q=${encodeURIComponent("王菲")}`, "Search results baseline", "NONE", "SEARCH", 1440, 950, 1],
    ["08", "08-search-album-desktop.png", `/albums/${searchAlbum.slug}/?${search}`, "Search → Album return desktop", "SEARCH", "SEARCH", 1440, 950, 1],
    ["09", "09-search-album-mobile.png", `/albums/${searchAlbum.slug}/?${search}`, "Search → Album return mobile", "SEARCH", "SEARCH", 390, 844, 1],
    ["10", "10-search-artist.png", `/artists/artist-${searchAlbum.artists[0]!.neteaseArtistId}/?${search}`, "Search → Artist return", "SEARCH", "SEARCH", 1280, 900, 1],
    ["11", "11-search-relation-continuation.png", `/albums/${secondary.slug}/?entry=album&trail=${searchAlbum.slug}&via=genre&${search}`, "Search → Album → relation continuation", "SEARCH", "RELATION", 1280, 900, 1],
    ["12", "12-direct-album-neutral.png", `/albums/${primary.slug}/`, "Direct Album has no false origin", "NONE", "DIRECT", 1280, 900, 1],
    ["13", "13-direct-artist-neutral.png", `/artists/artist-${primary.artists[0]!.neteaseArtistId}/`, "Direct Artist has no false origin", "NONE", "DIRECT", 1280, 900, 1],
    ["14", "14-for-you-provenance.png", `/albums/${primary.slug}/?pfrom=for-you`, "For You provenance remains distinct", "NONE", "PERSONAL", 1280, 900, 1],
    ["15", "15-explore-relation.png", `/albums/${secondary.slug}/?entry=explore&entryKey=relation&trail=${primary.slug}&via=genre`, "Explore relation provenance", "NONE", "RELATION", 1280, 900, 1],
    ["16", "16-serendipity-random.png", `/albums/${secondary.slug}/?entry=serendipity&entryKey=random`, "Explicit serendipity remains random", "NONE", "SERENDIPITY", 1280, 900, 1],
    ["17", "17-long-title.png", `/albums/${longTitleAlbum.slug}/?${library}`, "Long-title return stress", "LIBRARY", "COLLECTION", 390, 844, 1],
    ["18", "18-multi-artist.png", `/albums/${multiArtistAlbum.slug}/?${search}`, "Multi-credit return stress", "SEARCH", "SEARCH", 768, 900, 1],
    ["19", "19-journey-390.png", `/albums/${primary.slug}/?${library}`, "390px representative journey", "LIBRARY", "COLLECTION", 390, 844, 1],
    ["20", "20-journey-768.png", `/albums/${primary.slug}/?${library}`, "768px representative journey", "LIBRARY", "COLLECTION", 768, 900, 1],
    ["21", "21-journey-1024.png", `/albums/${primary.slug}/?${search}`, "1024px representative journey", "SEARCH", "SEARCH", 1024, 900, 1],
    ["22", "22-journey-1440.png", `/artists/artist-${primary.artists[0]!.neteaseArtistId}/?${library}`, "1440px representative journey", "LIBRARY", "COLLECTION", 1440, 950, 1],
    ["23", "23-journey-2048.png", `/albums/${primary.slug}/?${search}`, "2048px representative journey", "SEARCH", "SEARCH", 2048, 1152, 1],
    ["24", "24-journey-200-zoom.png", `/albums/${primary.slug}/?${library}`, "200% zoom representative journey", "LIBRARY", "COLLECTION", 1280, 900, 2],
  ].map(([caseId, filename, route, description, origin, provenance, width, height, zoom]) => ({
    caseId: caseId as string,
    filename: filename as string,
    route: route as string,
    description: description as string,
    origin: origin as string,
    provenance: provenance as string,
    viewport: { width: width as number, height: height as number, zoom: zoom as number },
  }));
  for (const item of cases) await capture(page, item);
  expect(captures).toHaveLength(24);

  const inventory = { schema: "r15-2g-screenshot-inventory/v1", qualification: "MACHINE QUALIFIED", humanAcceptance: "PENDING", cases: captures };
  await writeFile(path.join(evidenceRoot, "R15_2G_SCREENSHOT_INVENTORY.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  const cards = await Promise.all(captures.map(async (item) => {
    const bytes = await readFile(path.join(screenshotRoot, item.filename));
    return `<article><header><label><input type="checkbox"> HUMAN REVIEW</label><h2>${item.caseId}. ${item.description}</h2><p><b>Route/state:</b> <code>${item.route.replaceAll("&", "&amp;")}</code></p><p><b>Origin:</b> ${item.origin} · <b>provenance:</b> ${item.provenance} · <b>viewport:</b> ${item.viewport.width}×${item.viewport.height} @ ${item.viewport.zoom * 100}% · <b>PNG:</b> ${item.pixels.width}×${item.pixels.height}</p><p><b>SHA-256:</b> <code>${item.sha256}</code></p></header><img alt="${item.description}" src="data:image/png;base64,${bytes.toString("base64")}"></article>`;
  }));
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>R15-2G Human Quicklook</title><style>body{margin:0;background:#111;color:#eee;font:15px system-ui}main{max-width:1800px;margin:auto;padding:32px}h1{font-size:32px}article{border-top:1px solid #555;padding:28px 0}header{max-width:1100px}code{overflow-wrap:anywhere;color:#d9c7a2}img{display:block;max-width:100%;height:auto;margin-top:16px;border:1px solid #444}label{color:#f0b96a;font-weight:700}input{width:18px;height:18px}</style><main><h1>R15-2G RETURN JOURNEY — MACHINE QUALIFIED / HUMAN PENDING</h1><p>24 new-behavior cases. This package does not replace frozen R15-2C evidence and does not grant human acceptance.</p><p>Decision: ☐ ACCEPT &nbsp; ☐ REJECT &nbsp; Reviewer: __________ &nbsp; Date: __________</p>${cards.join("")}</main></html>`;
  const quicklookPath = path.join(evidenceRoot, "R15_2G_HUMAN_QUICKLOOK.html");
  await writeFile(quicklookPath, html);
  await writeFile(path.join(evidenceRoot, "R15_2G_MACHINE_QUALIFICATION.json"), `${JSON.stringify({ qualification: "MACHINE QUALIFIED", humanAcceptance: "PENDING", screenshotCount: 24, inventorySha256: sha256(await readFile(path.join(evidenceRoot, "R15_2G_SCREENSHOT_INVENTORY.json"))), quicklookSha256: sha256(await readFile(quicklookPath)), runtimeErrors: 0, externalRequests: 0, blockers: 0, majors: 0 }, null, 2)}\n`);
  await verifyFrozen2c();
});
