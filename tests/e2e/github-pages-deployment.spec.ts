import { expect, test } from "@playwright/test";

const basePath = "/album-discovery";
const expectedOrigin = "http://127.0.0.1:4311";

test("qualified static journeys work from the GitHub project-site base path", async ({ page, request }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];
  const externalProviderRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (failed) => {
    if (failed.failure()?.errorText !== "net::ERR_ABORTED") failedRequests.push(`${failed.failure()?.errorText} ${failed.url()}`);
  });
  page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  page.on("request", (resource) => {
    const url = new URL(resource.url());
    if (url.origin !== expectedOrigin) externalProviderRequests.push(resource.url());
  });

  for (const route of [
    `${basePath}/`,
    `${basePath}/explore/`,
    `${basePath}/search/?q=Radiohead`,
    `${basePath}/albums/ok-computer/`,
    `${basePath}/artists/artist-99384/`,
  ]) {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  }

  for (const resource of [
    `${basePath}/catalog/covers/detail/2060534.webp`,
    `${basePath}/catalog/covers/thumb/2060534.webp`,
    `${basePath}/homepage-production/vendor/three.module.min.txt`,
    `${basePath}/robots.txt`,
    `${basePath}/sitemap.xml`,
  ]) expect((await request.get(resource)).status(), resource).toBe(200);

  const notFound = await request.get(`${basePath}/albums/this-album-does-not-exist/`);
  expect(notFound.status()).toBe(404);
  expect(await notFound.text()).toContain("未找到该档案");

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(badResponses).toEqual([]);
  expect(externalProviderRequests).toEqual([]);
});
