import { expect, test } from "@playwright/test";

const proofDir = ".local-data/v1.1-physical-archive/static-art-proof";

test.describe("physical archive static core path", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Static art proof is captured once in Chromium.");

  for (const sample of [
    { name: "album", path: "/albums/inside-the-cable-temple/", marker: ".pa-album-file" },
    { name: "artist", path: "/artists/artist-6452/", marker: ".pa-artist-file" },
    { name: "discover", path: "/discover/", marker: ".pa-filter-desk" },
  ]) {
    test(`${sample.name} has a distinct physical archive composition`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(sample.path);
      await expect(page.locator(sample.marker)).toBeVisible();
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("body")).toHaveClass(/pa-site/);
      await page.screenshot({ path: `${proofDir}/${sample.name}-1440-full.png`, fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await expect(page.locator(sample.marker)).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
        .toBe(true);
      await page.screenshot({ path: `${proofDir}/${sample.name}-390-full.png`, fullPage: true });
    });
  }

  test("album file keeps the approved content order", async ({ page }) => {
    await page.goto("/albums/inside-the-cable-temple/");
    const headings = await page.locator(".album-detail__content h2").allTextContents();
    const index = (name: string) => headings.findIndex((heading) => heading.includes(name));
    expect(index("RYM 社区评分")).toBeLessThan(index("流派"));
    expect(index("流派")).toBeLessThan(index("聆听场景"));
    expect(index("聆听场景")).toBeLessThan(index("曲目表"));
    expect(index("同艺人其他专辑")).toBeLessThan(index("继续探索"));
  });

  test("discovery desk keeps the real filter contract", async ({ page }) => {
    await page.goto("/discover/");
    await expect(page.getByLabel("核心流派", { exact: true })).toBeVisible();
    await expect(page.getByLabel("相关流派", { exact: true })).toBeVisible();
    await expect(page.getByLabel("聆听场景", { exact: true })).toBeVisible();
    await expect(page.getByLabel("年代", { exact: true })).toBeVisible();
    await expect(page.getByLabel("发行类型", { exact: true })).toBeVisible();
    await expect(page.getByLabel("排序", { exact: true })).toBeVisible();
  });
});
