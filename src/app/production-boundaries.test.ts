import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogAlbums, publishedCatalog } from "@/catalog/published-catalog";

describe("production delivery boundaries", () => {
  it("contains no fictional scores, production mocks, or MusicBrainz identity fields", () => {
    const serialized = JSON.stringify(publishedCatalog);
    expect(catalogAlbums.length).toBeGreaterThanOrEqual(60);
    expect(serialized).not.toMatch(/rymRating|rymScore|fictional rating|mock album|musicbrainzReleaseGroupId|representativeReleaseId/i);
    expect(publishedCatalog.source).toMatchObject({ catalog: "netease", runtimeRequestsAllowed: false });
  });

  it("does not perform runtime provider network requests", () => {
    const files = ["src/catalog/published-catalog.ts", "src/catalog/queries.ts", "src/catalog/recommendation.ts", "src/features/personal-state/personal-state-provider.tsx"];
    for (const file of files) expect(readFileSync(resolve(file), "utf8")).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  });

  it("keeps every published destination on the matching HTTPS NetEase album page", () => {
    for (const album of catalogAlbums) {
      expect(album.externalUrl).toBe(`https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
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
