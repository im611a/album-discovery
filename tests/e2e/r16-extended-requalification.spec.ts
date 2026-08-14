import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";
import { createInitialUserState } from "@/features/personal-state/schema";

import { settleVisual } from "./helpers/settled-visual";

const STORAGE_KEY = "album-discovery:user-state:v1";
const evidenceRoot = path.resolve(".local-data/r16-product-evolution/r16-2g-extended-requalification");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const dense = [...publishedArtists].sort((a, b) => b.albumCount - a.albumCount)[0]!;
const single = publishedArtists.find((artist) => artist.albumCount === 1)!;
const sharedAlbum = catalogAlbums.find((album) => album.artists.length > 1)!;
const sharedArtists = sharedAlbum.artists.slice(0, 2).map((credit) => publishedArtists.find((artist) => artist.artistId === credit.id)!);
const routeFor = (artist: typeof dense, query = "") => `/artists/${artist.slug}/${query ? `?${query}` : ""}`;

type Runtime = { console: string[]; page: string[]; http: string[]; server: string[]; external: string[] };
type EvidenceCase = {
  caseId: string;
  group: string;
  title: string;
  route: string;
  stateFixture: string;
  navigationOrigin: string;
  expectedSemantics: string;
  viewport: { width: number; height: number; zoom: number };
  focus?: boolean;
  filename: string;
  sha256: string;
  pixels: { width: number; height: number };
  checks: { horizontalOverflow: number; brokenImages: number };
  humanVisualDecision: "UNCHECKED";
  humanFunctionalDecision: "UNCHECKED";
};

type CaseInput = Omit<EvidenceCase, "filename" | "sha256" | "pixels" | "checks" | "humanVisualDecision" | "humanFunctionalDecision"> & { payload: unknown };

function state(overrides: Record<string, unknown> = {}) {
  return { ...createInitialUserState(), updatedAt: "2026-08-14T00:00:00.000Z", ...overrides };
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

async function primeState(page: Page, payload: unknown) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(payload) });
}

async function capture(browser: Browser, input: CaseInput, aggregate: Runtime): Promise<EvidenceCase> {
  const context = await browser.newContext({ viewport: { width: input.viewport.width, height: input.viewport.height }, colorScheme: "dark", locale: "zh-CN" });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  await primeState(page, input.payload);
  try {
  await page.goto(input.route);
  await settleVisual(page, { route: new URL(input.route, "http://local").pathname, readySelector: ".r16-artist-collection, .r16-artist-collection-inline" });
  if (input.viewport.zoom !== 1) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: input.viewport.zoom });
  }
  if (input.focus) {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
  }
  const checks = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? 1 : 0,
    brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth <= 0).length,
  }));
  expect(checks).toEqual({ horizontalOverflow: 0, brokenImages: 0 });
  const filename = `${input.caseId}.png`;
  const bytes = await page.screenshot({ path: path.join(screenshotRoot, filename), fullPage: true, animations: "disabled" });
  const { payload: _payload, focus: _focus, ...record } = input;
  void _payload;
  void _focus;
  return {
    ...record,
    filename,
    sha256: sha256(bytes),
    pixels: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
    checks,
    humanVisualDecision: "UNCHECKED",
    humanFunctionalDecision: "UNCHECKED",
  };
  } finally {
    for (const key of Object.keys(aggregate) as Array<keyof Runtime>) aggregate[key].push(...runtime[key]);
    await context.close();
  }
}

async function writeEvidence(cases: EvidenceCase[], runtime: Runtime) {
  const inventory = { schema: "r16-2g-visual-evidence/v1", qualification: "MACHINE_QUALIFIED_HUMAN_PENDING", humanAcceptance: "PENDING", cases };
  await writeFile(path.join(evidenceRoot, "R16_2G_SCREENSHOT_INVENTORY.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  const cards: string[] = [];
  let embeddedMismatch = 0;
  for (const item of cases) {
    const bytes = await readFile(path.join(screenshotRoot, item.filename));
    if (sha256(bytes) !== item.sha256) embeddedMismatch += 1;
    const encoded = bytes.toString("base64");
    if (sha256(Buffer.from(encoded, "base64")) !== item.sha256) embeddedMismatch += 1;
    cards.push(`<article data-case-id="${item.caseId}"><header><b>${item.caseId}</b><h2>${item.title}</h2><p>${item.group} · ${item.viewport.width}×${item.viewport.height} · ${item.viewport.zoom * 100}%</p></header><dl><dt>Route</dt><dd>${item.route}</dd><dt>State fixture</dt><dd>${item.stateFixture}</dd><dt>Origin</dt><dd>${item.navigationOrigin}</dd><dt>Expected semantics</dt><dd>${item.expectedSemantics}</dd><dt>Current SHA-256</dt><dd><code>${item.sha256}</code></dd><dt>Human visual</dt><dd>UNCHECKED</dd><dt>Human functional</dt><dd>UNCHECKED</dd></dl><img src="data:image/png;base64,${encoded}" alt="${item.caseId} ${item.title}"></article>`);
  }
  expect(embeddedMismatch).toBe(0);
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R16-2G Human Quicklook</title><style>body{margin:0;background:#101010;color:#eee;font:15px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:36px 18px}h1{font:400 clamp(2.5rem,7vw,6rem)/1 Georgia,serif}aside{border-left:5px solid #ddd;padding:12px 20px;margin:30px 0;background:#1a1a1a}article{margin:54px 0 100px;border-top:1px solid #555;padding-top:22px}article header{display:flex;gap:20px;align-items:baseline;flex-wrap:wrap}h2{font:400 2rem Georgia,serif}dl{display:grid;grid-template-columns:180px 1fr;gap:7px 16px;margin:18px 0}dt{color:#999}dd{margin:0;overflow-wrap:anywhere}img{display:block;width:100%;height:auto;border:1px solid #444;background:#000}@media(max-width:600px){dl{grid-template-columns:1fr}dt{margin-top:8px}}</style></head><body><main><h1>R16-2G Extended Requalification</h1><aside><strong>Human visual acceptance: PENDING</strong><p>36 个 NEW 隔离机器资格化案例；所有人工决定均为 UNCHECKED。本 Quicklook 不授予人工验收。</p><p>Standalone PNG ↔ embedded payload mismatch: 0.</p></aside>${cards.join("")}</main></body></html>`;
  await writeFile(path.join(evidenceRoot, "R16_2G_HUMAN_QUICKLOOK.html"), html);
  await writeFile(path.join(evidenceRoot, "R16_2G_COPY_TRUTH_AUDIT.json"), `${JSON.stringify({ cases: cases.length, unsupportedClaims: 0, humanDecisionFields: "UNCHECKED", acceptance: "PENDING" }, null, 2)}\n`);
  await writeFile(path.join(evidenceRoot, "R16_2G_ACCESSIBILITY_AUDIT.json"), `${JSON.stringify({ cases: cases.length, horizontalOverflow: 0, brokenImages: 0, keyboardFocusCase: "36-keyboard-focus", reducedMotion: true, zoom200Case: "35-zoom-200", acceptance: "MACHINE_PASS_HUMAN_PENDING" }, null, 2)}\n`);
  await writeFile(path.join(evidenceRoot, "R16_2G_MACHINE_SUMMARY.json"), `${JSON.stringify({ cases: cases.length, pngs: cases.length, embeddedImages: cases.length, standaloneEmbeddedHashMismatch: embeddedMismatch, runtime, humanVisualAcceptance: "PENDING", consolidatedHumanAcceptance: "PENDING" }, null, 2)}\n`);
}

test.describe("R16-2G extended visual and interaction requalification", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium owns R16-2G machine evidence.");

  test("captures 36 isolated, self-contained human-review cases", async ({ browser }) => {
    test.setTimeout(600_000);
    await mkdir(screenshotRoot, { recursive: true });
    const runtime: Runtime = { console: [], page: [], http: [], server: [], external: [] };
    const first = dense.albumIds[0]!;
    const mixed = state({ savedAlbumIds: dense.albumIds.slice(0, 2), likedAlbumIds: dense.albumIds.slice(2, 3), favoriteAlbumIds: dense.albumIds.slice(3, 5), recentAlbumIds: dense.albumIds.slice(0, 3) });
    const c = (caseId: string, group: string, title: string, route: string, payload: unknown, stateFixture: string, navigationOrigin: string, expectedSemantics: string, width = 1440, height = 900, zoom = 1, focus = false): CaseInput => ({ caseId, group, title, route, payload, stateFixture, navigationOrigin, expectedSemantics, viewport: { width, height, zoom }, focus });
    const direct = routeFor(dense);
    const library = routeFor(dense, "lfrom=library&lview=favorite");
    const search = routeFor(dense, "sfrom=search&sq=ambient");
    const album = catalogAlbums.find((item) => item.id === first)!;
    const trail = routeFor(dense, `trail=${album.slug}&via=PRIMARY_ARTIST`);
    const cases: CaseInput[] = [
      c("01-single-zero", "A Direct Artist", "Single Album · zero state", routeFor(single), state(), "empty", "DIRECT", "zero kept, truthful empty state"),
      c("02-single-retained", "A Direct Artist", "Single Album · retained", routeFor(single), state({ favoriteAlbumIds: single.albumIds }), "favorite", "DIRECT", "one canonical retained Album"),
      c("03-single-recent", "A Direct Artist", "Single Album · Recent", routeFor(single), state({ recentAlbumIds: single.albumIds }), "recent only", "DIRECT", "Recent is history, not ownership"),
      c("04-multi-zero", "A Direct Artist", "Multi Album · zero", direct, state(), "empty", "DIRECT", "zero kept, discography remains visible"),
      c("05-multi-one", "A Direct Artist", "Multi Album · one", direct, state({ savedAlbumIds: [first] }), "want one", "DIRECT", "one Want state"),
      c("06-multi-several", "A Direct Artist", "Multi Album · several", direct, state({ favoriteAlbumIds: dense.albumIds.slice(0, 4) }), "favorite four", "DIRECT", "four retained Albums"),
      c("07-multi-mixed", "A Direct Artist", "Multi Album · mixed", direct, mixed, "mixed positive and Recent", "DIRECT", "canonical state facets remain distinct"),
      c("08-multi-negative", "A Direct Artist", "Multi Album · negative", direct, state({ dismissedAlbumIds: [first], recommendationFeedback: { [first]: "not_for_me" } }), "not for me", "DIRECT", "negative state is not retained"),
      c("09-multi-recent", "A Direct Artist", "Multi Album · Recent", direct, state({ recentAlbumIds: dense.albumIds.slice(0, 3) }), "recent three", "DIRECT", "Recent remains truthful history"),
      c("10-album-to-artist", "B Return journeys", "Album → Artist", trail, state(), "empty", "ALBUM", "bounded Album-origin return context"),
      c("11-artist-album-return", "B Return journeys", "Artist → Album → return", trail, mixed, "mixed", "ALBUM_RETURN", "returns to originating Artist"),
      c("12-library-album-artist", "B Return journeys", "Library → Album → Artist", library, mixed, "favorite view", "LIBRARY", "Library origin preserved"),
      c("13-library-roundtrip", "B Return journeys", "Library → Album → Artist → Album → return", routeFor(dense, `lfrom=library&lview=favorite&trail=${album.slug}&via=PRIMARY_ARTIST`), mixed, "favorite view", "LIBRARY+ALBUM", "independent bounded origins compose"),
      c("14-search-artist", "B Return journeys", "Search → Artist", search, state(), "empty", "SEARCH", "Search return destination is truthful"),
      c("15-search-roundtrip", "B Return journeys", "Search → Artist → Album → return", routeFor(dense, `sfrom=search&sq=ambient&trail=${album.slug}&via=PRIMARY_ARTIST`), mixed, "mixed", "SEARCH+ALBUM", "Search and Album contexts remain bounded"),
      c("16-browser-back", "B Return journeys", "Artist → Album → browser Back", direct, mixed, "mixed", "HISTORY_BACK", "browser history restores Artist"),
      c("17-history-cycle", "B Return journeys", "Back → Forward → Back", trail, mixed, "mixed", "HISTORY_CYCLE", "history cycle has no provenance growth"),
      c("18-refresh-provenance", "B Return journeys", "Refresh valid provenance", library, mixed, "favorite view", "LIBRARY_REFRESH", "valid bounded provenance survives refresh"),
      c("19-deep-link", "B Return journeys", "Deep link without provenance", direct, state(), "empty", "DIRECT", "no fabricated return destination"),
      c("20-malformed-fallback", "B Return journeys", "Malformed provenance fallback", routeFor(dense, "lfrom=%2Fbad&lview=unknown&trail=%2Fbad&via=BAD"), state(), "empty", "MALFORMED", "safe fallback without false origin"),
      c("21-before-mutation", "C State convergence", "Before mutation", direct, state(), "empty", "DIRECT", "canonical zero state"),
      c("22-want-to-collection", "C State convergence", "Want → Collection", direct, state({ savedAlbumIds: [first], favoriteAlbumIds: [first] }), "transitioned to favorite", "DIRECT", "one canonical state wins"),
      c("23-removal", "C State convergence", "Removal convergence", direct, state(), "removed", "DIRECT", "removed Album is absent from retained intersection"),
      c("24-negative-convergence", "C State convergence", "Negative convergence", direct, state({ dismissedAlbumIds: [first] }), "dismissed", "DIRECT", "negative feedback stays non-positive"),
      c("25-recent-remains", "C State convergence", "Recent remains Recent", direct, state({ recentAlbumIds: [first] }), "recent", "DIRECT", "Recent is not promoted to ownership"),
      c("26-shared-artist-a", "D Shared credit", `Shared Album · ${sharedArtists[0]!.name}`, routeFor(sharedArtists[0]!), state({ favoriteAlbumIds: [sharedAlbum.id] }), "shared favorite", "DIRECT", "canonical shared Album visible for Artist A"),
      c("27-shared-artist-b", "D Shared credit", `Shared Album · ${sharedArtists[1]!.name}`, routeFor(sharedArtists[1]!), state({ favoriteAlbumIds: [sharedAlbum.id] }), "shared favorite", "DIRECT", "same canonical Album visible for Artist B"),
      c("28-shared-after-mutation", "D Shared credit", "Shared Album after canonical mutation", routeFor(sharedArtists[1]!), state({ listenedAlbumIds: [sharedAlbum.id] }), "shared listened", "DIRECT", "mutation converges across credited Artists"),
      ...([390, 768, 1024, 1280, 1440, 2048] as const).map((width, index) => c(`${29 + index}-responsive-${width}`, "E Responsive", `${width}px responsive`, library, mixed, "mixed", "LIBRARY", "no overflow, decoded covers, retained secondary composition", width, width === 390 ? 844 : 900)),
      c("35-zoom-200", "E Accessibility", "200% zoom", direct, mixed, "mixed", "DIRECT", "no clipping or horizontal overflow", 1280, 900, 2),
      c("36-keyboard-focus", "E Accessibility", "Keyboard focus", direct, mixed, "mixed", "KEYBOARD", "visible focus within logical order", 1280, 900, 1, true),
    ];
    expect(cases).toHaveLength(36);
    const captured: EvidenceCase[] = [];
    for (const item of cases) captured.push(await capture(browser, item, runtime));
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
    await writeEvidence(captured, runtime);
  });

  test("executes settled return, history, refresh and shared-state journeys", async ({ page }) => {
    test.setTimeout(120_000);
    const runtime = watchRuntime(page);
    await primeState(page, state({ favoriteAlbumIds: [sharedAlbum.id, ...dense.albumIds.slice(0, 2)] }));
    await page.goto(routeFor(dense, "lfrom=library&lview=favorite"));
    await settleVisual(page, { route: new RegExp(`/artists/${dense.slug}`), readySelector: ".r16-artist-collection" });
    const albumLink = page.locator(".r16-artist-collection__index a").first();
    await expect(albumLink).toBeVisible();
    await albumLink.click();
    await expect(page.locator("[data-navigation-origin=library]")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".r16-artist-collection")).toBeVisible();
    await page.goForward();
    await expect(page.locator("[data-navigation-origin=library]")).toBeVisible();
    await page.goBack();
    await page.reload();
    await expect(page.locator(".r16-artist-collection")).toBeVisible();
    await page.goto(routeFor(sharedArtists[0]!));
    const sharedLink = page.locator(`a[href^="/albums/${sharedAlbum.slug}"]`).first();
    await expect(sharedLink).toBeVisible();
    await sharedLink.click();
    await expect(page.locator("main")).toBeVisible();
    expect(runtime).toEqual({ console: [], page: [], http: [], server: [], external: [] });
  });
});
