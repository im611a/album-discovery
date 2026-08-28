import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { APPROVED_HOMEPAGE_MAPPING } from "./approved-homepage-mapping";
import { buildHomepageContent, homepageContent } from "./homepage-data-adapter";

describe("homepage data adapter", () => {
  it("resolves the approved 24 + 6 + 2 mapping from the published catalog", () => {
    expect(homepageContent.gallery).toHaveLength(24);
    expect(homepageContent.stage).toHaveLength(6);
    expect(homepageContent.reserve).toHaveLength(2);
    expect(homepageContent.gallery.map((item) => item.albumId)).toEqual(
      APPROVED_HOMEPAGE_MAPPING.gallery.map((item) => item.albumId),
    );
    expect(homepageContent.stage.map((item) => item.slug)).toEqual(
      APPROVED_HOMEPAGE_MAPPING.stage.map((item) => item.slug),
    );
  });

  it("uses 30 distinct albums and excludes reserve albums", () => {
    const used = [...homepageContent.gallery, ...homepageContent.stage].map((item) => item.albumId);
    expect(new Set(used).size).toBe(30);
    expect(homepageContent.reserve.every((item) => !used.includes(item.albumId))).toBe(true);
  });

  it("takes titles, artists, slugs and local covers from published data", () => {
    for (const item of [...homepageContent.gallery, ...homepageContent.stage]) {
      const source = catalogAlbums.find((album) => album.id === item.albumId);
      expect(source).toBeDefined();
      expect(item).toMatchObject({
        slug: source?.slug,
        title: source?.title,
        artists: source?.artists.map((artist) => artist.name),
      });
      expect(item.cover).toBe(source?.cover.src ?? source?.cover.thumbnailSrc);
      expect(item.cover.startsWith("/")).toBe(true);
    }
  });

  it("attaches album-owned palettes only to the six Stage records", () => {
    expect(homepageContent.stage.every((item) => item.vinylPalette.sourceCover === item.cover)).toBe(true);
    expect(new Set(homepageContent.stage.map((item) => JSON.stringify(item.vinylPalette))).size).toBe(6);
    expect(homepageContent.gallery.every((item) => !("vinylPalette" in item))).toBe(true);
  });

  it("keeps the approved Madvillainy identity available for the visual-only vinyl label", () => {
    const label = homepageContent.gallery.find((item) => item.slug === "madvillainy");
    expect(label).toMatchObject({ albumId: "album:316551", title: "Madvillainy", cover: expect.stringContaining("/catalog/covers/detail/316551.webp") });
  });

  it("rejects a missing ID instead of silently choosing a fallback", () => {
    const missing = catalogAlbums.filter((album) => album.id !== APPROVED_HOMEPAGE_MAPPING.gallery[0].albumId);
    expect(() => buildHomepageContent(missing)).toThrow(/不存在/);
  });
});
