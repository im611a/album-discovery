import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { buildLibraryPresentationFixtures } from "@/catalog/library-presentation-fixtures";
import { catalogAlbums } from "@/catalog/published-catalog";

import { settleVisual } from "./helpers/settled-visual";

const STORAGE_KEY = "album-discovery:user-state:v1";
const outputRoot = path.resolve(process.env.R15_2C_EVIDENCE_ROOT ?? ".local-data/r15-product-evolution/r15-2c-visible-library");
const screenshotRoot = path.join(outputRoot, "screenshots");
const fixtures = new Map(buildLibraryPresentationFixtures(catalogAlbums).map((fixture) => [fixture.name, fixture]));
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

type RuntimeAudit = { console: string[]; page: string[]; http: string[]; external: string[] };
type CaptureRecord = {
  caseId: string;
  section: string;
  filename: string;
  route: string;
  fixture: string;
  purpose: string;
  viewport: { width: number; height: number; zoom: number };
  pixels: { width: number; height: number };
  sha256: string;
  checks: { horizontalOverflow: number; clippedHeading: number; unreachableControls: number; brokenImages: number; layoutOverlap: number; remoteCovers: number };
};

const audits = new WeakMap<Page, RuntimeAudit>();
const captures: CaptureRecord[] = [];

function fullState(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    taste: { genres: [], descriptors: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" },
    likedAlbumIds: [],
    favoriteAlbumIds: [],
    savedAlbumIds: [],
    listenedAlbumIds: [],
    dismissedAlbumIds: [],
    recommendationFeedback: {},
    recentAlbumIds: [],
    onboardingCompleted: true,
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

function fixtureState(name: string) {
  const fixture = [...fixtures.values()].find((item) => item.name === name);
  if (!fixture) throw new Error(`Unknown R15 Library fixture: ${name}`);
  return fullState(fixture.state as Record<string, unknown>);
}

async function installState(page: Page, value: ReturnType<typeof fullState>) {
  await page.goto("/library/?r15StateSetup=1");
  await expect(page.locator("[data-library-ready=true]")).toBeVisible();
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)), { key: STORAGE_KEY, payload: value });
}

async function layoutAudit(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const heading = document.querySelector("main h1")?.getBoundingClientRect();
    const controls = [...document.querySelectorAll<HTMLElement>(".r15-library-facets a, .r15-library-tools input, .r15-library-tools button, .r15-library-tools select")];
    const unreachableControls = controls.filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width < 24 || rect.height < 24 || rect.left < -1 || rect.right > viewportWidth + 1 || style.display === "none" || style.visibility === "hidden";
    }).length;
    const records = [...document.querySelectorAll<HTMLElement>("[data-library-album]")].map((node) => node.getBoundingClientRect());
    let layoutOverlap = 0;
    for (let left = 0; left < records.length; left += 1) {
      for (let right = left + 1; right < records.length; right += 1) {
        const a = records[left]!;
        const b = records[right]!;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) layoutOverlap += 1;
      }
    }
    const images = [...document.querySelectorAll<HTMLImageElement>("main img")];
    return {
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1 ? 1 : 0,
      clippedHeading: !heading || heading.width <= 0 || heading.left < -1 || heading.right > viewportWidth + 1 ? 1 : 0,
      unreachableControls,
      brokenImages: images.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0).length,
      layoutOverlap,
      remoteCovers: images.filter((image) => {
        const url = new URL(image.currentSrc, location.href);
        return url.origin !== location.origin;
      }).length,
    };
  });
}

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function captureCase(page: Page, item: {
  caseId: string;
  section: string;
  filename: string;
  route: string;
  fixture: string;
  purpose: string;
  width: number;
  height: number;
  zoom?: number;
  state?: ReturnType<typeof fullState>;
}) {
  await page.setViewportSize({ width: item.width, height: item.height });
  await installState(page, item.state ?? fixtureState(item.fixture));
  await page.goto(item.route);
  await settleVisual(page, { route: "/library/", readySelector: "[data-library-ready=true]" });
  const zoom = item.zoom ?? 1;
  let resetZoom: (() => Promise<void>) | null = null;
  if (zoom !== 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: zoom });
    resetZoom = async () => { await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }); };
  }
  const checks = await layoutAudit(page);
  expect(checks).toEqual({ horizontalOverflow: 0, clippedHeading: 0, unreachableControls: 0, brokenImages: 0, layoutOverlap: 0, remoteCovers: 0 });
  const mainText = await page.locator("main").innerText();
  expect(mainText).not.toMatch(/最近播放|最近收听|播放历史|收听时长|云端同步/);
  const target = path.join(screenshotRoot, item.filename);
  await page.screenshot({ path: target, fullPage: true, animations: "disabled" });
  const bytes = await readFile(target);
  captures.push({
    caseId: item.caseId,
    section: item.section,
    filename: item.filename,
    route: item.route,
    fixture: item.fixture,
    purpose: item.purpose,
    viewport: { width: item.width, height: item.height, zoom },
    pixels: pngDimensions(bytes),
    sha256: sha256(bytes),
    checks,
  });
  if (resetZoom) await resetZoom();
}

function htmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function writeReviewerArtifacts() {
  const inventory = {
    schema: "r15-2c-screenshot-inventory/v1",
    generatedAt: new Date().toISOString(),
    cases: captures,
    counts: {
      screenshots: captures.length,
      embeddedPayloads: captures.length,
      evidenceHashFailures: 0,
      horizontalOverflow: captures.reduce((sum, item) => sum + item.checks.horizontalOverflow, 0),
      clippedHeading: captures.reduce((sum, item) => sum + item.checks.clippedHeading, 0),
      unreachableControls: captures.reduce((sum, item) => sum + item.checks.unreachableControls, 0),
      brokenImages: captures.reduce((sum, item) => sum + item.checks.brokenImages, 0),
      layoutOverlap: captures.reduce((sum, item) => sum + item.checks.layoutOverlap, 0),
      remoteCovers: captures.reduce((sum, item) => sum + item.checks.remoteCovers, 0),
    },
  };
  await writeFile(path.join(outputRoot, "R15_2C_SCREENSHOT_INVENTORY.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  const sections = [...new Set(captures.map((item) => item.section))];
  const cards: string[] = [];
  for (const section of sections) {
    const sectionCards = await Promise.all(captures.filter((item) => item.section === section).map(async (item) => {
      const bytes = await readFile(path.join(screenshotRoot, item.filename));
      return `<article><header><strong>${htmlEscape(item.caseId)} — ${htmlEscape(item.purpose)}</strong><span>${item.viewport.width}×${item.viewport.height} @ ${item.viewport.zoom * 100}% · ${htmlEscape(item.fixture)}</span><code>${htmlEscape(item.route)}</code></header><img src="data:image/png;base64,${bytes.toString("base64")}" alt="${htmlEscape(item.caseId)} ${htmlEscape(item.purpose)}"><footer>PNG ${item.pixels.width}×${item.pixels.height} · SHA-256 ${item.sha256}</footer></article>`;
    }));
    cards.push(`<section><h2>${htmlEscape(section)}</h2>${sectionCards.join("")}</section>`);
  }
  const questions = [
    "Does Library clearly feel like a return/archive destination?",
    "Does it belong visually to Album Discovery and avoid dashboard/SaaS appearance?",
    "Is the durable collection visually primary while facets remain restrained?",
    "Is Recent clearly distinct from saved collection?",
    "Are all album covers rendered correctly?",
    "Does the dense Library remain composed?",
    "Does the empty Library feel intentional?",
    "Are tablet and mobile useful, readable and coherent?",
    "Are long titles and multiple artist credits handled intentionally?",
    "Does any copy falsely imply playback or listening history?",
    "Can a user clearly return to an Album without visual competition?",
    "Does any area feel unfinished?",
  ];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R15-2C Library Human Quicklook</title><style>html{color-scheme:dark;background:#080808;color:#eee}body{margin:0;font:15px/1.5 ui-sans-serif,system-ui;padding:clamp(20px,4vw,72px)}h1{font:500 clamp(38px,7vw,96px)/.92 Georgia,serif;max-width:10em}h2{margin:80px 0 24px;padding-top:24px;border-top:1px solid #444;font:500 28px/1.2 Georgia,serif}p,li{max-width:78ch;color:#bbb}article{margin:0 0 64px}header{display:grid;grid-template-columns:1fr auto;gap:6px 20px;margin-bottom:12px}header code{grid-column:1/-1;color:#9d9d9d}header span,footer{color:#aaa;font-size:12px}img{display:block;width:100%;height:auto;background:#111;border:1px solid #333}footer{margin-top:8px;overflow-wrap:anywhere}.gate{padding:20px;border:1px solid #765f34;color:#e8d3a4}ol{columns:2;column-gap:50px}@media(max-width:700px){header{grid-template-columns:1fr}header code{grid-column:auto}ol{columns:1}}</style></head><body><h1>R15-2C LIBRARY HUMAN QUICKLOOK</h1><p class="gate">Machine-qualified candidate only. Human visual acceptance: PENDING. This self-contained file embeds every PNG and does not depend on the application.</p><p>${captures.length} review cases · isolated R15-2C evidence · no accepted R12/R13/R14 evidence is embedded or modified.</p>${cards.join("")}<section><h2>Human review questions</h2><ol>${questions.map((question) => `<li>${htmlEscape(question)}</li>`).join("")}</ol></section></body></html>`;
  const quicklookPath = path.join(outputRoot, "R15_2C_HUMAN_QUICKLOOK.html");
  await writeFile(quicklookPath, html);
  const written = await readFile(quicklookPath, "utf8");
  const payloads = [...written.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((match) => Buffer.from(match[1]!, "base64"));
  expect(payloads).toHaveLength(captures.length);
  expect(payloads.map(sha256).sort()).toEqual(captures.map((item) => item.sha256).sort());
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  const audit: RuntimeAudit = { console: [], page: [], http: [], external: [] };
  audits.set(page, audit);
  page.on("console", (message) => { if (message.type() === "error") audit.console.push(message.text()); });
  page.on("pageerror", (error) => audit.page.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) audit.http.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "data:" && url.protocol !== "blob:" && url.origin !== "http://127.0.0.1:4311") audit.external.push(request.url());
  });
});

test.afterEach(async ({ page }) => {
  expect(audits.get(page)).toEqual({ console: [], page: [], http: [], external: [] });
});

test.afterAll(async () => {
  expect(captures).toHaveLength(18);
  await writeReviewerArtifacts();
});

test("captures the complete R15-2C human-review matrix with settled local artwork", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const longFixture = fixtureState("library-long-titles");
  const multiFixture = fixtureState("library-multi-artist");
  const stressState = fullState({
    savedAlbumIds: longFixture.savedAlbumIds,
    favoriteAlbumIds: multiFixture.favoriteAlbumIds,
  });
  const cases: readonly [string, string, string, string, string, string, number, number, number?, ReturnType<typeof fullState>?][] = [
    ["01", "SECTION F — Empty states", "01-desktop-empty-1440.png", "/library/", "library-empty", "Desktop empty Library", 1440, 950],
    ["02", "SECTION B — Desktop", "02-desktop-small-1440.png", "/library/", "library-small", "Desktop small collection", 1440, 950],
    ["03", "SECTION C — Collection densities", "03-desktop-dense-1440.png", "/library/", "library-dense", "Desktop dense collection", 1440, 950],
    ["04", "SECTION D — Facets", "04-desktop-favorites-1440.png", "/library/?view=favorite", "library-favorites", "Favorites facet", 1440, 950],
    ["05", "SECTION D — Facets", "05-desktop-saved-1440.png", "/library/?view=saved", "library-saved", "Saved facet", 1440, 950],
    ["06", "SECTION D — Facets", "06-desktop-listened-1440.png", "/library/?view=listened", "library-listened", "Marked-listened facet", 1440, 950],
    ["07", "SECTION E — Recent", "07-desktop-collection-recent-1440.png", "/library/", "library-collection-plus-recent", "Collection plus Recent return trail", 1440, 950],
    ["08", "SECTION E — Recent", "08-desktop-recent-only-1440.png", "/library/?view=recent", "library-recent-only", "Recent-only truthful state", 1440, 950],
    ["09", "SECTION I — Long text / multi-credit", "09-desktop-text-stress-1440.png", "/library/", "library-long-titles + library-multi-artist", "Long-title and multi-credit stress", 1440, 950, 1, stressState],
    ["10", "SECTION B — Desktop", "10-desktop-large-2048.png", "/library/", "library-medium", "Very large desktop composition", 2048, 1080],
    ["11", "SECTION G — Tablet", "11-tablet-1024.png", "/library/", "library-medium", "1024px tablet geometry", 1024, 900],
    ["12", "SECTION G — Tablet", "12-tablet-768.png", "/library/", "library-small", "768px tablet geometry", 768, 900],
    ["13", "SECTION H — Mobile", "13-mobile-collection-390.png", "/library/", "library-small", "Mobile collection", 390, 844],
    ["14", "SECTION C — Collection densities", "14-mobile-dense-390.png", "/library/", "library-mobile-dense", "Mobile dense collection", 390, 844],
    ["15", "SECTION F — Empty states", "15-mobile-empty-390.png", "/library/", "library-empty", "Mobile empty Library", 390, 844],
    ["16", "SECTION D — Facets", "16-mobile-favorite-390.png", "/library/?view=favorite", "library-favorites", "Mobile selected facet", 390, 844],
    ["17", "SECTION E — Recent", "17-mobile-recent-390.png", "/library/?view=recent", "library-recent-only", "Mobile Recent trail", 390, 844],
    ["18", "SECTION J — Accessibility / 200% zoom", "18-zoom-200-percent.png", "/library/", "library-small", "Representative state at 200% browser zoom", 1280, 900, 2],
  ];
  for (const item of cases) {
    await captureCase(page, { caseId: item[0], section: item[1], filename: item[2], route: item[3], fixture: item[4], purpose: item[5], width: item[6], height: item[7], zoom: item[8], state: item[9] });
  }
});

test("preserves native Library to Album return context, refresh and facet Back behavior", async ({ page }) => {
  const value = fixtureState("library-collection-plus-recent");
  await installState(page, value);
  await page.goto("/library/?view=saved&sort=title");
  const first = page.locator("[data-library-album] a").first();
  const href = await first.getAttribute("href");
  expect(href).toMatch(/\/albums\/[^?]+\?lfrom=library&lview=saved/);
  await first.click();
  await expect(page).toHaveURL(/lfrom=library/);
  await page.reload();
  await expect(page.locator(".r13-discovery")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/library\/\?view=saved&sort=title/);
  await expect(page.locator("[data-library-view=saved]")).toBeVisible();

  const albumHref = `/albums/${catalogAlbums[0]!.slug}/`;
  await page.goto(albumHref);
  await expect(page.locator("main h1")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("lfrom")).toBeNull();
});

test("reflects explicit mutation, supports keyboard focus and keeps deep links deterministic", async ({ page }) => {
  const value = fixtureState("library-small");
  await installState(page, value);
  await page.goto("/library/?view=saved");
  await page.reload();
  await expect(page.locator("[data-library-view=saved]")).toBeVisible();
  const firstFacet = page.locator(".r15-library-facets a").first();
  await firstFacet.focus();
  await expect(firstFacet).toBeFocused();
  const focusStyle = await firstFacet.evaluate((node) => {
    const style = getComputedStyle(node);
    return { outline: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focusStyle.outline).not.toBe("none");
  expect(Number.parseFloat(focusStyle.width)).toBeGreaterThan(0);

  await page.goto("/library/");
  const record = page.locator("[data-library-album]").first();
  const id = await record.getAttribute("data-library-album");
  await record.locator("summary").click();
  await record.getByRole("button", { name: "已想听" }).click();
  await page.waitForFunction(({ key, albumId }) => !JSON.parse(localStorage.getItem(key) ?? "{}").savedAlbumIds.includes(albumId), { key: STORAGE_KEY, albumId: id });
  await expect(page.locator(`[data-library-album="${id}"]`)).toHaveCount(0);
});

test("empty and mobile journeys remain navigable without custom history", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installState(page, fixtureState("library-empty"));
  await page.goto("/library/");
  await page.getByRole("link", { name: "前往发现页浏览专辑目录" }).click();
  await expect(page).toHaveURL(/\/discover\//);
  await page.goBack();
  await expect(page.locator("[data-library-empty=FRESH_LIBRARY]")).toBeVisible();
  expect((await layoutAudit(page)).horizontalOverflow).toBe(0);
});
