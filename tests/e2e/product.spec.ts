import { expect, test, type Page } from "@playwright/test";

const forbiddenRuntimeHost = /meinhardtaxer|musicbrainz|coverartarchive|music\.163|rateyourmusic/i;

function watchRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: string[] = [];
  const requestFailures: string[] = [];
  const forbiddenRequests: string[] = [];
  page.on("console", (message) => {
    const expectedNotFoundNoise = page.url().includes("/albums/not-a-real-album/")
      && message.text().includes("Failed to load resource");
    if (message.type() === "error" && !expectedNotFoundNoise) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    const expectedNotFound = response.status() === 404 && url.pathname === "/albums/not-a-real-album/";
    if (response.status() >= 400 && !expectedNotFound) httpErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText !== "net::ERR_ABORTED") requestFailures.push(`${request.method()} ${request.url()} ${errorText}`);
  });
  page.on("request", (request) => {
    if (forbiddenRuntimeHost.test(request.url())) forbiddenRequests.push(request.url());
  });
  return { consoleErrors, pageErrors, httpErrors, requestFailures, forbiddenRequests };
}

function expectRuntimeClean(runtime: ReturnType<typeof watchRuntime>) {
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(runtime.httpErrors).toEqual([]);
  expect(runtime.requestFailures).toEqual([]);
  expect(runtime.forbiddenRequests).toEqual([]);
}

function isHomeAlbumTarget(value: string | null) {
  const target = new URL(value ?? "", "http://local");
  return /^\/albums\/[^/]+\/$/.test(target.pathname)
    && target.searchParams.get("pfrom") === "home"
    && [...target.searchParams.keys()].length === 1;
}

async function expectNoHorizontalOverflow(page: Page) {
  const measurement = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  }));
  expect(measurement.scrollWidth, JSON.stringify(measurement)).toBeLessThanOrEqual(measurement.clientWidth + 1);
}

async function scrollStageTo(page: Page, progress: number) {
  const metrics = await page.locator(".ad-stage").evaluate((element) => ({
    top: element.getBoundingClientRect().top + window.scrollY,
    travel: element.clientHeight - window.innerHeight,
  }));
  await page.evaluate(({ top, travel, progress: nextProgress }) => {
    window.scrollTo(0, top + travel * nextProgress);
  }, { ...metrics, progress });
}

test("reference-driven home preserves Stage progression, vinyl lifecycle, navigation and real links", async ({ page }) => {
  test.setTimeout(45_000);
  const runtime = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/?visualTest=1");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "专辑发现" })).toBeVisible();
  const root = page.locator("[data-homepage-production]");
  await expect(root).toHaveAttribute("data-runtime-state", "ready");
  await expect(root).toHaveAttribute("data-gallery-count", "24");
  await expect(root).toHaveAttribute("data-stage-count", "6");
  const galleryHrefs = await page.locator('#homepage-gallery a[href^="/albums/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  expect(galleryHrefs).toHaveLength(24);
  expect(galleryHrefs.every(isHomeAlbumTarget)).toBe(true);

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await expect(navigation.getByRole("link", { name: "目录" })).toHaveAttribute("href", /^\/discover\/?$/);
  await expect(navigation.getByRole("link", { name: "搜索" })).toHaveAttribute("href", /^\/search\/?$/);

  const canvas = page.locator("#homepageStageCanvas");
  await scrollStageTo(page, 0.204);
  await expect(canvas).toHaveAttribute("data-current-index", "0");
  await expect(canvas).toHaveAttribute("data-outgoing-index", "0");
  await expect(canvas).toHaveAttribute("data-incoming-index", "1");
  await expect(canvas).toHaveAttribute("data-vinyl-owner-index", "0");
  expect(Number(await canvas.getAttribute("data-vinyl-eject-progress"))).toBeGreaterThan(0);

  await scrollStageTo(page, 0.22);
  await expect(canvas).toHaveAttribute("data-current-index", "1");
  await expect(canvas).toHaveAttribute("data-outgoing-index", "0");
  await expect(canvas).toHaveAttribute("data-incoming-index", "1");
  await expect(canvas).toHaveAttribute("data-vinyl-owner-index", "1");
  await expect(page.locator("#homepageStageNumber")).toHaveText("/02");
  const href = await page.locator("#homepageStageTitle").getAttribute("href");
  expect(isHomeAlbumTarget(href)).toBe(true);
  await page.locator("#homepageStageTitle").click();
  await expect(page).toHaveURL(/\/albums\/[^/]+\/\?pfrom=home$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expectRuntimeClean(runtime);
});

test("discover, search, detail navigation and local state retain their current contracts", async ({ page }) => {
  test.setTimeout(45_000);
  const runtime = watchRuntime(page);
  await page.goto("/discover/");
  await page.getByLabel("核心流派", { exact: true }).selectOption("pop");
  await expect(page).toHaveURL(/core=pop/);
  await expect(page.locator("#catalog-tools-title")).toHaveText("433 张专辑");
  const filteredUrl = page.url();
  const albumLink = page.locator('.album-card a[href^="/albums/"]').first();
  await albumLink.click();
  await expect(page).toHaveURL(/\/albums\/[^/]+\/$/);
  const selectedAlbumTitle = await page.getByRole("heading", { level: 1 }).innerText();
  const wantButton = page.locator(".pa-album-file__local-state button").filter({ hasText: "想听" }).first();
  await expect(wantButton).toHaveText("想听");
  await wantButton.click();
  await expect(wantButton).toHaveText("已想听");
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(page.getByLabel("核心流派", { exact: true })).toHaveValue("pop");

  await page.goto("/library/?state=wantToListen");
  await expect(page.getByRole("heading", { level: 1, name: "我的专辑" })).toBeVisible();
  await expect(page.locator("main")).toContainText(selectedAlbumTitle);

  await page.goto("/search/");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("搜索专辑目录").fill("Radiohead");
  await page.getByRole("button", { name: "检索档案" }).click();
  await expect(page).toHaveURL(/q=Radiohead/);
  await expect(page.getByRole("heading", { name: "专辑" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "艺人" })).toBeVisible();

  await page.goto("/albums/fantasy-jay-chou/?visualTest=1");
  await expect(page.getByRole("heading", { level: 1, name: "范特西" })).toBeVisible();
  const sections = await page.locator(".album-detail__content > section").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-labelledby")),
  );
  expect(sections.indexOf("tracks-title")).toBeLessThan(sections.indexOf("same-artist-title"));
  expect(sections.indexOf("same-artist-title")).toBeLessThan(sections.indexOf("album-recommendations-title"));
  await page.locator(".album-detail__artists a").first().click();
  await expect(page).toHaveURL(
    /\/artists\/artist-6452\/\?entry=album&entryKey=fantasy-jay-chou&trail=fantasy-jay-chou$/,
  );
  await expect(page.getByRole("heading", { level: 1, name: "周杰伦" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/albums\/fantasy-jay-chou\/(?:\?.*)?$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "范特西" })).toBeVisible();
  expectRuntimeClean(runtime);
});

test("accepted home navigation, internal mobile menu and every required viewport remain keyboard-safe", async ({ page, browserName }) => {
  test.setTimeout(60_000);
  const runtime = watchRuntime(page);
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 720, height: 900 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?visualTest=1", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?visualTest=1");
  const homeNavigation = page.getByRole("navigation", { name: "主要导航" });
  await expect(homeNavigation.getByRole("link", { name: "目录" })).toBeVisible();
  await expect(homeNavigation.getByRole("link", { name: "搜索" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(".ad-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#homepage-gallery$/);

  await page.goto("/discover/");
  const menu = page.getByRole("button", { name: "打开菜单" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "关闭菜单" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await expect(page.getByRole("heading", { level: 1, name: "专辑目录" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  }
  expectRuntimeClean(runtime);
});

test("representative static routes render with one h1 and no runtime provider requests", async ({ page }) => {
  const runtime = watchRuntime(page);
  for (const route of [
    "/explore/", "/for-you/", "/new-releases/", "/library/", "/artists/",
    "/genres/", "/genres/core/pop/", "/genres/related/ambient/", "/scenes/night/",
    "/decades/2000s/", "/settings/",
    "/about/",
  ]) {
    await page.goto(`${route}?visualTest=1`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  }
  expectRuntimeClean(runtime);
  const response = await page.goto("/albums/not-a-real-album/?visualTest=1");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expectRuntimeClean(runtime);
});
