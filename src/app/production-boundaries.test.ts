import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogAlbums, publishedCatalog } from "@/catalog/published-catalog";
import { getAlbumDetailBySlug } from "@/catalog/published-album-details";

describe("production delivery boundaries", () => {
  it("contains no fictional scores, production mocks, or MusicBrainz identity fields", () => {
    const serialized = JSON.stringify(publishedCatalog);
    expect(catalogAlbums.length).toBeGreaterThanOrEqual(300);
    expect(serialized).not.toMatch(/rymScore|fictional rating|mock album|musicbrainzReleaseGroupId|representativeReleaseId/i);
    const ratedAlbums = catalogAlbums.filter((album) => album.rymRating !== null);
    expect(ratedAlbums).toHaveLength(13);
    expect(ratedAlbums.every((album) =>
      typeof album.rymRating === "number" &&
      album.rymRating > 0 &&
      album.rymRating <= 5 &&
      Number.isInteger(album.rymRatingCount),
    )).toBe(true);
    expect(publishedCatalog.source).toMatchObject({ catalog: "netease", runtimeRequestsAllowed: false });
  });
  it("keeps track lists out of the shared browser catalog index", () => {
    expect(catalogAlbums.length).toBe(1_330);
    expect(catalogAlbums.every((album) => !("tracks" in album))).toBe(true);
    expect(getAlbumDetailBySlug("wake-after-the-rain")?.tracks.length).toBeGreaterThan(0);
  });

  it("does not perform runtime provider network requests", () => {
    const files = ["src/catalog/published-catalog.ts", "src/catalog/queries.ts", "src/catalog/recommendation.ts", "src/features/personal-state/personal-state-provider.tsx"];
    for (const file of files) expect(readFileSync(resolve(file), "utf8")).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  });

  it("does not generate RYM secondary genres or descriptors from NetEase or editorial seeds", () => {
    const seeds = readFileSync(resolve("scripts/catalog/netease-seeds.mjs"), "utf8");
    const refresh = readFileSync(resolve("scripts/catalog/refresh-catalog.mjs"), "utf8");
    const rymResolver = readFileSync(resolve("scripts/catalog/rym-taxonomy.mjs"), "utf8");
    expect(seeds).not.toMatch(/relatedGenres|descriptors/);
    expect(refresh).not.toMatch(/seed\.relatedGenres|seed\.descriptors/);
    expect(rymResolver).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|rateyourmusic\.com/i);
  });

  it("keeps every published destination on the matching HTTPS NetEase album page", () => {
    for (const album of catalogAlbums) {
      expect(getAlbumDetailBySlug(album.slug)?.externalUrl).toBe(`https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
    }
  });

  it("does not publish inferred nationality, country, region, or language values", () => {
    for (const album of catalogAlbums) {
      expect(album).not.toHaveProperty("country");
      expect(album).not.toHaveProperty("region");
      expect(album).not.toHaveProperty("nationality");
      expect(album).not.toHaveProperty("language");
      expect(album).not.toHaveProperty("languages");
    }
  });
});
