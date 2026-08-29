import { expect, test, type Page } from "@playwright/test";

const basePath = "/album-discovery";
const origin = "http://127.0.0.1:4311";

function watchRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(request.url());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith(`blob:${origin}`) && !url.startsWith("data:")) externalRequests.push(url);
  });
  return { consoleErrors, pageErrors, httpErrors, failedRequests, externalRequests };
}

async function settleAndAudit(page: Page) {
  await page.waitForLoadState("load");
  const result = await page.evaluate(async () => {
    const images = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    });
    await Promise.all(images.map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve) => {
        const done = () => resolve();
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        window.setTimeout(done, 1_500);
      });
      if (image.complete && image.naturalWidth) try { await image.decode(); } catch { /* dimensions remain authoritative */ }
    }));
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc),
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.broken).toEqual([]);
}

test("V6 closes detail whitespace, artist readability, and dock-only vinyl dragging", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const runtime = watchRuntime(page);
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    const suffix = `${viewport.width}x${viewport.height}`;
    await page.setViewportSize(viewport);

    await page.goto(`${basePath}/albums/madvillainy/?visualTest=1`);
    const detailGeometry = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(".album-detail__hero")!.getBoundingClientRect();
      const cover = document.querySelector<HTMLElement>(".pa-album-file__object")!.getBoundingClientRect();
      const intro = document.querySelector<HTMLElement>(".album-detail__intro")!.getBoundingClientRect();
      const tracks = document.querySelector<HTMLElement>(".detail-card--tracks")!.getBoundingClientRect();
      return {
        heroToTracks: tracks.top - hero.bottom,
        coverTail: hero.bottom - cover.bottom,
        introTail: hero.bottom - intro.bottom,
        coverWidth: cover.width,
        coverRatio: cover.width / Math.max(1, cover.height),
      };
    });
    expect(detailGeometry.heroToTracks).toBeGreaterThanOrEqual(0);
    expect(detailGeometry.heroToTracks).toBeLessThan(2);
    expect(detailGeometry.coverRatio).toBeGreaterThan(.99);
    expect(detailGeometry.coverRatio).toBeLessThan(1.01);
    if (viewport.width >= 1024) {
      expect(detailGeometry.coverTail).toBeLessThan(170);
      expect(detailGeometry.introTail).toBeLessThan(90);
      expect(detailGeometry.coverWidth).toBeGreaterThan(viewport.width >= 1800 ? 500 : 420);
    }
    await settleAndAudit(page);
    if (viewport.width === 1920 || viewport.width === 1440) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `detail-hero-middle-lower-${suffix}.png`), animations: "disabled" });
      await page.getByRole("heading", { name: "曲目表" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("screenshots", `detail-hero-to-tracks-${suffix}.png`), animations: "disabled" });
    }

    await page.goto(`${basePath}/artists/?genre=rock&visualTest=1`);
    const selected = page.locator('.ux-artist-categories a[aria-current="page"]');
    await expect(selected).toContainText("摇滚");
    const readability = await page.evaluate(() => {
      const selectedLink = document.querySelector<HTMLElement>('.ux-artist-categories a[aria-current="page"]')!;
      const card = document.querySelector<HTMLElement>(".r12-artist-index .artist-card")!;
      const name = card.querySelector<HTMLElement>("h3")!;
      const meta = card.querySelector<HTMLElement>("p")!;
      const genre = card.querySelector<HTMLElement>(".artist-card__genres");
      const action = card.querySelector<HTMLElement>(".artist-card__open")!;
      const selectedStyle = getComputedStyle(selectedLink);
      return {
        selectedBackground: selectedStyle.backgroundColor,
        selectedColor: selectedStyle.color,
        nameSize: Number.parseFloat(getComputedStyle(name).fontSize),
        metaSize: Number.parseFloat(getComputedStyle(meta).fontSize),
        genreSize: genre ? Number.parseFloat(getComputedStyle(genre).fontSize) : 0,
        actionSize: Number.parseFloat(getComputedStyle(action).fontSize),
      };
    });
    expect(readability.selectedBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(readability.selectedBackground).not.toBe(readability.selectedColor);
    expect(readability.nameSize).toBeGreaterThanOrEqual(19);
    expect(readability.metaSize).toBeGreaterThanOrEqual(14);
    expect(readability.genreSize).toBeGreaterThanOrEqual(13);
    expect(readability.actionSize).toBeGreaterThanOrEqual(12);
    await settleAndAudit(page);
    if (viewport.width === 1440 || viewport.width === 390) {
      await page.screenshot({ path: testInfo.outputPath("screenshots", `artists-selected-list-${suffix}.png`), animations: "disabled" });
    }
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${basePath}/?visualTest=1`);
  const marker = page.locator(".ad-marker");
  const fixed = page.locator(".ad-fixed");
  const selection = page.locator(".ad-vinyl-selection");
  await expect(marker).toHaveAttribute("data-vinyl-label", "madvillainy");
  await expect(selection).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-vinyl-hero-1920x1080.png"), animations: "disabled" });
  await page.evaluate(() => {
    const gallery = document.querySelector<HTMLElement>(".ad-gallery");
    if (gallery) window.scrollTo(0, Math.max(0, gallery.offsetTop - 200));
  });
  await expect(fixed).toHaveAttribute("data-marker-phase", "dock");
  await expect(selection).toBeHidden();
  await expect(marker).toHaveAttribute("data-drag-enabled", "true");
  await page.waitForTimeout(220);
  const before = await marker.boundingBox();
  expect(before).not.toBeNull();
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-vinyl-dock-1920x1080.png"), animations: "disabled" });
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 - 220, before!.y + before!.height / 2 + 120, { steps: 4 });
  await page.mouse.up();
  const after = await marker.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(150);
  expect(after!.y).toBeGreaterThanOrEqual(104);
  expect(after!.x).toBeGreaterThanOrEqual(16);
  expect(after!.x + after!.width).toBeLessThanOrEqual(1920 - 16 + 1);
  expect(after!.y + after!.height).toBeLessThanOrEqual(1080 - 16 + 1);
  await expect(marker).not.toHaveAttribute("data-dragging", "true");
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-vinyl-dragged-1920x1080.png"), animations: "disabled" });
  await page.locator(".ad-continuation").scrollIntoViewIfNeeded();
  await expect(fixed).toHaveAttribute("data-marker-phase", "release");
  await page.screenshot({ path: testInfo.outputPath("screenshots", "home-vinyl-release-1920x1080.png"), animations: "disabled" });
  await settleAndAudit(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${basePath}/?visualTest=1`);
  await page.evaluate(() => {
    const gallery = document.querySelector<HTMLElement>(".ad-gallery");
    if (gallery) window.scrollTo(0, Math.max(0, gallery.offsetTop - 200));
  });
  await expect(page.locator(".ad-fixed")).toHaveAttribute("data-marker-phase", "dock");
  const reducedMarker = page.locator(".ad-marker");
  await expect(reducedMarker).toHaveAttribute("data-drag-enabled", "true");
  const reducedBefore = await reducedMarker.boundingBox();
  await page.mouse.move(reducedBefore!.x + reducedBefore!.width / 2, reducedBefore!.y + reducedBefore!.height / 2);
  await page.mouse.down();
  await page.mouse.move(reducedBefore!.x + reducedBefore!.width / 2 - 90, reducedBefore!.y + reducedBefore!.height / 2 + 45);
  await page.mouse.up();
  const reducedAfter = await reducedMarker.boundingBox();
  expect(Math.abs(reducedAfter!.x - reducedBefore!.x)).toBeGreaterThan(60);
  await settleAndAudit(page);

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.failedRequests).toEqual([]);
  expect(runtime.externalRequests).toEqual([]);
});
