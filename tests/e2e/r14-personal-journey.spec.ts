import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { captureSettledVisual } from "./helpers/settled-visual";

const STORAGE_KEY = "album-discovery:user-state:v1";
const seedIds = ["album:18915", "album:18905", "album:15190"];
const acceptedReviewRoot = ".local-data/r14-product-evolution/r14-3n-consolidated-human-review";
const acceptedScreenshotRoot = `${acceptedReviewRoot}/screenshots`;
const evidenceRoot = ".local-data/r14-product-evolution/r14-machine-capture-scratch/personal-journey";
const protectedCaptureNames = [
  "after-album-personal-1280.png",
  "after-album-relation-fallback-1280.png",
  "after-artist-personal-1280.png",
  "after-cross-route-long-1440.png",
  "after-for-you-negative-1280.png",
  "after-home-dense-1440.png",
];
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let acceptedEvidenceBefore = new Map<string, string>();

async function acceptedEvidenceHashes() {
  const files = [
    `${acceptedReviewRoot}/R14_3N_CONSOLIDATED_HUMAN_QUICKLOOK.html`,
    ...(await readdir(acceptedScreenshotRoot)).filter((name) => name.endsWith(".png")).map((name) => path.join(acceptedScreenshotRoot, name)),
  ];
  return new Map(await Promise.all(files.map(async (file) => [file.replaceAll("\\", "/"), sha256(await readFile(file))] as const)));
}
type RuntimeAudit = { console: string[]; page: string[]; http: string[]; external: string[] };
const runtimeAudits = new WeakMap<Page, RuntimeAudit>();
const forbiddenHost = /musicbrainz|coverartarchive|music\.163|rateyourmusic|meinhardtaxer/i;

test.beforeEach(async ({ page }) => {
  const audit: RuntimeAudit = { console: [], page: [], http: [], external: [] };
  runtimeAudits.set(page, audit);
  page.on("console", (message) => { if (message.type() === "error") audit.console.push(message.text()); });
  page.on("pageerror", (error) => audit.page.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) audit.http.push(`${response.status()} ${response.url()}`); });
  page.on("request", (request) => { if (forbiddenHost.test(request.url())) audit.external.push(request.url()); });
});
test.beforeAll(async () => {
  acceptedEvidenceBefore = await acceptedEvidenceHashes();
  await mkdir(evidenceRoot, { recursive: true });
});

test.afterAll(async () => {
  const acceptedEvidenceAfter = await acceptedEvidenceHashes();
  expect([...acceptedEvidenceAfter]).toEqual([...acceptedEvidenceBefore]);
  for (const name of protectedCaptureNames) await expect(access(path.join(evidenceRoot, name))).resolves.toBeUndefined();
});

test.afterEach(async ({ page }) => {
  expect(runtimeAudits.get(page)).toEqual({ console: [], page: [], http: [], external: [] });
});

function state(overrides: Record<string, unknown> = {}) {
  return { version: 1, taste: { genres: [], descriptors: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" }, likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recommendationFeedback: {}, recentAlbumIds: [], onboardingCompleted: true, updatedAt: "2026-08-12T00:00:00.000Z", ...overrides };
}

async function installState(page: Page, value: ReturnType<typeof state>) {
  await page.goto("/for-you/?r14StateSetup=1");
  await expect(page.locator(".r14-personal-journey[data-personal-status]")).toBeVisible();
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)), { key: STORAGE_KEY, payload: value });
}

async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
}

async function capture(page: Page, filename: string, readySelector = "main") {
  return captureSettledVisual(page, { route: new URL(page.url()).pathname, readySelector }, { path: `${evidenceRoot}/${filename}`, fullPage: true });
}

test("R14 empty state stays truthful on Home and For You", async ({ page }) => {
  await installState(page, state());
  await page.goto("/?visualTest=1");
  await expect(page.getByText("这里没有足够的个人线索")).toBeVisible();
  await capture(page, "after-home-empty-1440.png", ".r14-home-journey");
  await page.goto("/for-you/?visualTest=1");
  await expect(page.getByRole("heading", { name: "一组有来源的下一张" })).toBeVisible();
  await expect(page.getByText("这里没有足够的个人线索")).toBeVisible();
  await capture(page, "after-for-you-empty-1440.png", ".r14-for-you-journey");
});

test("R14 sparse For You state reacts to negative feedback and survives refresh", async ({ page }) => {
  await installState(page, state({ likedAlbumIds: [seedIds[0]], recommendationFeedback: { [seedIds[0]]: "like" } }));
  await page.goto("/for-you/?visualTest=1");
  const first = page.locator(".r14-journey-card").first();
  const title = await first.getByRole("heading", { level: 3 }).innerText();
  await expect(first).toHaveAttribute("data-provenance", "PERSONAL");
  await first.locator("summary").click();
  await first.getByRole("button", { name: "不适合我" }).click();
  await expect(page.locator(".r14-journey-card").first().getByRole("heading", { level: 3 })).not.toHaveText(title);
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "{}").dismissedAlbumIds?.length > 0, STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await capture(page, "after-for-you-negative-1280.png", ".r14-for-you-journey");
});

test("R14 dense Home remains subordinate to the accepted editorial stage", async ({ page }) => {
  await installState(page, state({ likedAlbumIds: [seedIds[0]], favoriteAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]], recentAlbumIds: seedIds }));
  await page.goto("/?visualTest=1");
  await expect(page.locator(".ad-stage")).toBeVisible();
  await expect(page.locator(".r14-home-journey")).toBeVisible();
  const order = await page.locator(".ad-stage, .r14-home-journey, .ad-ending").evaluateAll((nodes) => nodes.map((node) => node.className));
  expect(order[0]).toContain("ad-stage");
  expect(order[1]).toContain("r14-home-journey");
  expect(order[2]).toContain("ad-ending");
  await capture(page, "after-home-dense-1440.png", ".r14-home-journey");
});

test("R14 Album keeps personal and R13 relation authorities separate", async ({ page }) => {
  await installState(page, state({ recentAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]] }));
  await page.goto("/albums/fantasy-jay-chou/?visualTest=1");
  const personal = page.locator(".r14-album-journey");
  const relation = page.locator(".r13-discovery");
  await expect(personal).toBeVisible();
  await expect(relation).toBeVisible();
  expect(await personal.evaluate((node) => node.compareDocumentPosition(document.querySelector(".r13-discovery")!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await capture(page, "after-album-personal-1280.png", ".r14-album-journey");
});

test("R14 Artist preserves chronology before personal and relation continuations", async ({ page }) => {
  await installState(page, state({ favoriteAlbumIds: [seedIds[0]] }));
  await page.goto("/artists/artist-6452/?visualTest=1");
  await expect(page.getByRole("heading", { name: "作品年表", exact: true })).toBeVisible();
  await expect(page.locator(".r14-artist-journey")).toBeVisible();
  await expect(page.locator(".r13-entity-discovery--artist")).toBeVisible();
  const sequence = await page.locator(".r12-discography, .r14-artist-journey, .r13-entity-discovery--artist").evaluateAll((nodes) => nodes.map((node) => node.className));
  expect(sequence).toHaveLength(3);
  await capture(page, "after-artist-personal-1280.png", ".r14-artist-journey");
});

test("R14 Explore exposes relation, personal and random as three authorities", async ({ page }) => {
  await installState(page, state({ recentAlbumIds: [seedIds[0]] }));
  await page.goto("/explore/?mode=personal&visualTest=1");
  await expect(page.getByText("个人入口", { exact: true })).toBeVisible();
  await expect(page.locator(".r14-explore-journey")).toBeVisible();
  await capture(page, "after-explore-personal-1024.png", ".r14-explore-journey");
  await page.getByRole("link", { name: "流派漫游" }).click();
  await expect(page.locator("[data-explore-mode=genre]")).toBeVisible();
  await page.getByRole("link", { name: "随机一张" }).click();
  await expect(page.locator("[data-explore-mode=random]")).toBeVisible();
  await expect(page.getByText(/随机只选择入口，不制造关系/)).toBeVisible();
  await capture(page, "after-explore-serendipity-1024.png", "[data-explore-mode=random]");
  await page.goBack();
  await expect(page.locator("[data-explore-mode=genre]")).toBeVisible();
  await page.goBack();
  await expect(page.locator("[data-explore-mode=personal]")).toBeVisible();
});

test("R14 shared journey is responsive, keyboard reachable and readable at 200 percent", async ({ page, browserName }) => {
  test.setTimeout(60_000);
  await installState(page, state({ likedAlbumIds: [seedIds[0]], recentAlbumIds: [seedIds[1]] }));
  for (const width of [390, 768, 1024, 1280, 1440, 2048]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.goto("/for-you/?visualTest=1");
    await expect(page.locator(".r14-for-you-journey")).toBeVisible();
    await expect(page.locator(".r14-journey-card__continue").first()).toBeVisible();
    await noOverflow(page);
    await capture(page, `after-for-you-${width}.png`, ".r14-for-you-journey");
  }
  await page.locator(".r14-journey-card__continue").first().focus();
  await expect(page.locator(".r14-journey-card__continue").first()).toBeFocused();
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await noOverflow(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  }
});

test("R14 personal path survives deep link, refresh, Back and remains bounded", async ({ page }) => {
  await installState(page, state({ likedAlbumIds: [seedIds[0]], favoriteAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]] }));
  await page.goto("/for-you/?visualTest=1");
  await page.locator(".r14-journey-card__continue").first().click();
  await expect(page).toHaveURL(/pfrom=for-you/);
  await page.reload();
  await expect(page.locator(".r14-album-journey")).toBeVisible();
  for (let step = 0; step < 7; step += 1) {
    const next = page.locator(".r14-album-journey .r14-journey-card__continue").first();
    if (!await next.count()) break;
    await next.click();
    await expect(page.locator(".r14-album-journey")).toBeVisible();
  }
  const url = new URL(page.url());
  expect((url.searchParams.get("ptrail") ?? "").split("~").filter(Boolean).length).toBeLessThanOrEqual(4);
  await capture(page, "after-cross-route-long-1440.png", ".r14-album-journey");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("R14 reviewer variants cover relation fallback, single-work Artist and mobile hierarchy", async ({ page }) => {
  await installState(page, state());
  await page.goto("/albums/fantasy-jay-chou/?visualTest=1");
  await expect(page.locator(".r14-album-journey .r14-journey-card").first()).toHaveAttribute("data-provenance", "RELATION_FALLBACK");
  await expect(page.locator(".r14-album-journey")).toContainText("不是个人偏好结论");
  await capture(page, "after-album-relation-fallback-1280.png", ".r14-album-journey");
  await page.goto("/artists/artist-12127888/?visualTest=1");
  await expect(page.locator(".r13-entity-discovery--artist")).toContainText("单作品艺人");
  await capture(page, "after-artist-single-work-1280.png", ".r13-entity-discovery--artist");
  await page.goto("/explore/?mode=genre&value=pop&kind=core&visualTest=1");
  await expect(page.locator("[data-explore-mode=genre]")).toBeVisible();
  await capture(page, "after-explore-relation-1280.png", "[data-explore-mode=genre]");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/albums/fantasy-jay-chou/?visualTest=1");
  await noOverflow(page);
  await capture(page, "after-album-mobile-390.png", ".r14-album-journey");
  await page.goto("/artists/artist-12127888/?visualTest=1");
  await noOverflow(page);
  await capture(page, "after-artist-mobile-390.png", ".r13-entity-discovery--artist");
  await page.goto("/explore/?mode=personal&visualTest=1");
  await noOverflow(page);
  await capture(page, "after-explore-personal-empty-mobile-390.png", ".r14-explore-journey");
});
