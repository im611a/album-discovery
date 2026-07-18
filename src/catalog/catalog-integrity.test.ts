import { describe, expect, it } from "vitest";
import { catalogAlbums, catalogTaxonomy } from "./published-catalog";

describe("published catalog integrity", () => {
  it("meets the real-catalog delivery floor", () => {
    expect(catalogAlbums).toHaveLength(120);
    expect(catalogAlbums.filter((album) => album.editorial)).toHaveLength(24);
    expect(catalogTaxonomy).toHaveLength(12);
  });
  it("keeps MusicBrainz identity, unique slugs, honest covers, and no fictional rating", () => {
    expect(new Set(catalogAlbums.map((album) => album.id)).size).toBe(120);
    expect(new Set(catalogAlbums.map((album) => album.slug)).size).toBe(120);
    for (const album of catalogAlbums) {
      expect(album.musicbrainzReleaseGroupId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(["local", "fallback"]).toContain(album.cover.kind);
      expect(album).not.toHaveProperty("rymScore");
      expect(album).not.toHaveProperty("rating");
    }
  });
  it("requires a verified destination and honest editorial status for every flagship", () => {
    for (const album of catalogAlbums.filter((item) => item.editorial)) {
      expect(album.externalLinks.some((link) => link.verified)).toBe(true);
      expect(album.editorial?.confidence).toBe("metadata_based");
      expect(album.editorial?.humanReviewed).toBe(false);
    }
  });
});
