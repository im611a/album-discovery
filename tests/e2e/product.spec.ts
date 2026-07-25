import { expect, test, type Page } from "@playwright/test";

const forbiddenRuntimeHost = /meinhardtaxer|musicbrainz|coverartarchive|music\.163|rateyourmusic/i;

function watchRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const forbiddenRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (forbiddenRuntimeHost.test(request.url())) forbiddenRequests.push(request.url());
  });
  return { consoleErrors, forbiddenRequests };
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

test("editorial home preserves navigation, real links and all nine sections", async ({ page }) => {
  const runtime = watchRuntime(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?visualTest=1");
  await expect(page.getByRole("heading", { level: 1, name: "专辑发现" })).toBeVisible();
  await expect(page.locator(".pa-cabinet-slot")).toHaveCount(6);
  await expect(page.locator(".pa-featured-scene")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: /三张唱片/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /一位创作者/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /十五条.*收藏柜/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近收录" })).toBeVisible();
  const href = await page.locator(".pa-cabinet-slot__sleeve").first().getAttribute("href");
  expect(href).toMatch(/^\/albums\/[^/]+\/$/);
  await page.locator(".pa-cabinet-slot__sleeve").first().click();
  await expect(page).toHaveURL(/\/albums\/[^/]+\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.forbiddenRequests).toEqual([]);
});

test("discover, search and deep detail routes retain their URL contracts", async ({ page }) => {
  const runtime = watchRuntime(page);
  await page.goto("/discover/");
  await page.locator("details.filter-panel").evaluate((element: HTMLDetailsElement) => { element.open = true; });
  await page.getByLabel("核心流派", { exact: true }).selectOption("pop");
  await expect(page).toHaveURL(/genre=pop/);
  await expect(page.getByText(/找到/).first()).toBeVisible();

  await page.goto("/search/");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("搜索专辑目录").fill("Radiohead");
  await page.getByRole("button", { name: "搜索" }).click();
  expect(runtime.consoleErrors).toEqual([]);
  await expect(page).toHaveURL(/q=Radiohead/);
  await expect(page.getByRole("heading", { name: "专辑" })).toBeVisible();

  await page.goto("/albums/fantasy-jay-chou/?visualTest=1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const sections = await page.locator(".album-detail__content > section").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-labelledby")),
  );
  expect(sections.indexOf("tracks-title")).toBeLessThan(sections.indexOf("same-artist-title"));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("mobile menu is keyboard operable and every required viewport avoids overflow", async ({ page }) => {
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
    await page.goto("/?visualTest=1");
    await expectNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: "打开菜单" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "关闭菜单" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
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
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.forbiddenRequests).toEqual([]);
  runtime.consoleErrors.length = 0;
  const response = await page.goto("/albums/not-a-real-album/?visualTest=1");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(runtime.forbiddenRequests).toEqual([]);
});
