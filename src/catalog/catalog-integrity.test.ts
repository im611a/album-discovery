import { describe, expect, it } from "vitest";
import { catalogAlbums, catalogTaxonomy } from "./published-catalog";

describe("published NetEase catalog integrity", () => {
  it("meets the Chinese-first catalog delivery floor", () => {
    expect(catalogAlbums.length).toBeGreaterThanOrEqual(60);
    expect(catalogAlbums.filter((album) => album.editorial).length).toBeGreaterThanOrEqual(5);
    expect(catalogTaxonomy.filter((item) => item.kind === "core").length).toBeGreaterThanOrEqual(10);
  });

  it("keeps unique NetEase identity, unique slugs, honest covers, and no fictional rating", () => {
    expect(new Set(catalogAlbums.map((album) => album.neteaseAlbumId)).size).toBe(catalogAlbums.length);
    expect(new Set(catalogAlbums.map((album) => album.slug)).size).toBe(catalogAlbums.length);
    for (const album of catalogAlbums) {
      expect(album.neteaseAlbumId).toMatch(/^\d+$/);
      expect(["local", "fallback"]).toContain(album.cover.kind);
      expect(album).not.toHaveProperty("musicbrainzReleaseGroupId");
      expect(album).not.toHaveProperty("rymScore");
      expect(album).not.toHaveProperty("rating");
    }
  });

  it("gives every album a secure matching NetEase destination", () => {
    for (const album of catalogAlbums) {
      expect(album.externalUrl).toBe(`https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
    }
  });

  it("keeps market channels as discovery provenance only", () => {
    const overlap = catalogAlbums.filter((album) => album.sourceMarketChannels.length > 1);
    expect(overlap.length).toBeGreaterThan(0);
    for (const album of overlap) {
      expect(album).not.toHaveProperty("region");
      expect(album).not.toHaveProperty("language");
    }
  });

  it.each(catalogAlbums)("publishes $slug with complete NetEase-owned catalog fields", (album) => {
    expect(album.internalId).toBe(`album:${album.neteaseAlbumId}`);
    expect(album.title).not.toBe("");
    expect(album.artists.length).toBeGreaterThan(0);
    expect(album.trackCount).toBe(album.tracks.length);
    expect(album.externalUrl).toBe(`https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
    expect(album.cover.kind === "local" ? album.cover.src : album.cover.reason).toBeTruthy();
  });
});
