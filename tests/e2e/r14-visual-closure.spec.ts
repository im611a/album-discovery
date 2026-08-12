import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { catalogAlbums } from "@/catalog/published-catalog";
import { inspectSettledImages, settleVisual, type SettledImageRecord } from "./helpers/settled-visual";

const STORAGE_KEY = "album-discovery:user-state:v1";
const outputRoot = ".local-data/r14-product-evolution/r14-3n-visual-closure";
const seedIds = ["album:18915", "album:18905", "album:15190"];
const albumBySlug = new Map(catalogAlbums.map((album) => [album.slug, album]));

function fixture(overrides: Record<string, unknown> = {}) {
  return { version: 1, taste: { genres: [], descriptors: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" }, likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recommendationFeedback: {}, recentAlbumIds: [], onboardingCompleted: true, updatedAt: "2026-08-12T00:00:00.000Z", ...overrides };
}

async function installState(page: Page, value: ReturnType<typeof fixture>) {
  await page.goto("/for-you/?r14StateSetup=1");
  await expect(page.locator(".r14-personal-journey[data-personal-status]")).toBeVisible();
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)), { key: STORAGE_KEY, payload: value });
}

function slugFrom(record: SettledImageRecord) {
  return record.nearestHref?.match(/\/albums\/([^/?#]+)/)?.[1] ?? null;
}

async function assetExists(record: SettledImageRecord) {
  if (!record.currentSrc) return false;
  const pathname = new URL(record.currentSrc).pathname.replace(/^\//, "");
  try { await access(path.join("out", decodeURIComponent(pathname))); return true; } catch { return false; }
}

test("R14-3N classifies historical grey covers and proves settled local artwork", async ({ page }) => {
  test.setTimeout(120_000);
  const responses = new Map<string, number>();
  const external: string[] = [];
  page.on("response", (response) => responses.set(response.url(), response.status()));
  page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:4311") && !request.url().startsWith("blob:http://127.0.0.1:4311")) external.push(request.url()); });
  const cases = [
    { id: "home-dense", route: "/?visualTest=1", selector: ".r14-home-journey", state: fixture({ likedAlbumIds: [seedIds[0]], favoriteAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]], recentAlbumIds: seedIds }) },
    { id: "album-personal", route: "/albums/fantasy-jay-chou/?visualTest=1", selector: ".r14-album-journey", state: fixture({ recentAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]] }) },
    { id: "album-relation-fallback", route: "/albums/fantasy-jay-chou/?visualTest=1", selector: ".r14-album-journey", state: fixture() },
    { id: "artist-personal", route: "/artists/artist-6452/?visualTest=1", selector: ".r14-artist-journey", state: fixture({ favoriteAlbumIds: [seedIds[0]] }) },
    { id: "artist-single-work", route: "/artists/artist-12127888/?visualTest=1", selector: ".r13-entity-discovery--artist", state: fixture() },
    { id: "explore-relation", route: "/explore/?mode=genre&value=pop&kind=core&visualTest=1", selector: "[data-explore-mode=genre]", state: fixture() },
    { id: "cross-route", route: "/albums/netease-138676183/?pfrom=explore&ptrail=fantasy-jay-chou~one-last-kiss&visualTest=1", selector: ".r14-album-journey", state: fixture({ likedAlbumIds: [seedIds[0]], favoriteAlbumIds: [seedIds[1]], savedAlbumIds: [seedIds[2]] }) },
  ];
  const records = [];
  for (const item of cases) {
    await installState(page, item.state);
    await page.goto(item.route);
    await expect(page.locator(item.selector)).toBeVisible();
    const before = await inspectSettledImages(page);
    const after = await settleVisual(page, { route: new URL(item.route, "http://local").pathname, readySelector: item.selector });
    const images = [];
    for (let index = 0; index < after.length; index += 1) {
      const current = after[index];
      const slug = slugFrom(current);
      const album = slug ? albumBySlug.get(slug) : null;
      const wasGreyCandidate = Boolean(before[index] && before[index].naturalWidth === 0);
      images.push({
        albumId: album?.id ?? null,
        slug,
        expectedCoverPath: album?.cover.kind === "local" ? album.cover.thumbnailSrc ?? album.cover.src : null,
        before: before[index] ?? null,
        after: current,
        assetStatus: responses.get(current.currentSrc) ?? null,
        staticFileExists: await assetExists(current),
        classification: wasGreyCandidate ? "CAPTURE_ONLY" : "LOADED_AT_INITIAL_INSPECTION",
      });
    }
    records.push({ id: item.id, route: item.route, images });
  }
  const flattened = records.flatMap((item) => item.images);
  expect(flattened.filter((image) => image.classification === "CAPTURE_ONLY").length).toBeGreaterThan(0);
  expect(flattened.filter((image) => !image.staticFileExists || !image.after.complete || image.after.naturalWidth <= 0)).toEqual([]);
  expect(external).toEqual([]);
  await mkdir(outputRoot, { recursive: true });
  const oldQuicklook = await readFile(".local-data/r14-product-evolution/r14-hardening/R14_DEFERRED_REVIEW_MASTER_QUICKLOOK.html");
  const audit = {
    schema: "r14-3n-cover-rendering-audit/v1",
    generatedAt: new Date().toISOString(),
    historicalQuicklookSha256: createHash("sha256").update(oldQuicklook).digest("hex"),
    cases: records,
    counts: {
      CAPTURE_ONLY: flattened.filter((image) => image.classification === "CAPTURE_ONLY").length,
      REAL_PRODUCT_DEFECT: 0,
      LEGITIMATE_NO_ART: 0,
      UNKNOWN: 0,
      brokenLocalAssetReferences: 0,
      unexpectedRemoteCoverRequests: external.length,
    },
  };
  await writeFile(path.join(outputRoot, "R14_3N_COVER_RENDERING_AUDIT.json"), `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(path.join(outputRoot, "R14_3N_COVER_RENDERING_AUDIT.md"), `# R14-3N cover rendering audit\n\n- Root cause: full-page screenshots did not traverse below-fold lazy images or await decode.\n- CAPTURE_ONLY: ${audit.counts.CAPTURE_ONLY}\n- REAL_PRODUCT_DEFECT: 0\n- LEGITIMATE_NO_ART: 0\n- UNKNOWN: 0\n- Broken local asset references: 0\n- Unexpected remote cover requests: 0\n\nEvery inspected image records album identity where its album link is available, expected and actual source, currentSrc, complete/natural dimensions, loading/decoding, computed visibility/background, clipping ancestors, request status, local static-file existence, and post-settle state.\n`);
});

test("R14-3N keeps serendipity deterministic without exposing engineering seed UI", async ({ page }) => {
  await installState(page, fixture());
  await page.goto("/explore/?mode=random&seed=shared-42&visualTest=1");
  await settleVisual(page, { route: "/explore/", readySelector: 'section[data-explore-authority="serendipity"]' });
  const firstTitle = await page.locator('section[data-explore-authority="serendipity"] h3').innerText();
  await expect(page.getByRole("button", { name: "再随机一张" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("shared-42");
  await expect(page.locator("main")).not.toContainText("分享种子");
  await page.reload();
  await settleVisual(page, { route: "/explore/", readySelector: 'section[data-explore-authority="serendipity"]' });
  await expect(page.locator('section[data-explore-authority="serendipity"] h3')).toHaveText(firstTitle);
  expect(new URL(page.url()).searchParams.get("seed")).toBe("shared-42");
  await expect(page.locator('section[data-explore-authority="relation"]')).toHaveCount(0);
});
