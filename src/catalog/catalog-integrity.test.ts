import { describe, expect, it } from "vitest";
import rymAudit from "../../reports/catalog/rym-taxonomy-audit.json";
import { catalogAlbums, catalogTaxonomy, publishedCatalog } from "./published-catalog";
import { getAlbumDetailBySlug } from "./published-album-details";

describe("published NetEase catalog integrity", () => {
  it("meets the Chinese-first catalog delivery floor", () => {
    expect(catalogAlbums.length).toBeGreaterThanOrEqual(300);
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
      expect(getAlbumDetailBySlug(album.slug)?.externalUrl).toBe(`https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
    }
  });

  it("keeps market channels as discovery provenance only", () => {
    for (const album of catalogAlbums) {
      expect(album).not.toHaveProperty("region");
      expect(album).not.toHaveProperty("language");
    }
  });

  it("publishes no inferred RYM secondary genres or descriptors without an offline snapshot", () => {
    expect(publishedCatalog.source.taxonomy).toBe("rym-offline-or-manual-core");
    expect(catalogTaxonomy.some((item) => item.kind === "related")).toBe(false);
    expect(publishedCatalog.descriptorTaxonomy).toEqual([]);
    for (const album of catalogAlbums) {
      expect(album.relatedGenres).toEqual([]);
      expect(album.rymRating).toBeNull();
    }
  });

  it("records composite RYM match evidence for every album without inventing a match", () => {
    expect(rymAudit).toMatchObject({ matched: 0, unmatched: catalogAlbums.length, ambiguous: 0 });
    expect(rymAudit.albums).toHaveLength(catalogAlbums.length);
    for (const item of rymAudit.albums) {
      expect(item).toMatchObject({
        status: "unmatched",
        reason: "no_authorized_offline_record",
        candidateReferences: [],
      });
      expect(item.evidence.titleAndAliases.length).toBeGreaterThan(0);
      expect(item.evidence.artists.length).toBeGreaterThan(0);
      expect(item.evidence.releaseType).toBeTruthy();
    }
  });

  it.each(["287974232", "286248593"])("keeps required album %s on manual core taxonomy only", (albumId) => {
    const album = catalogAlbums.find((item) => item.neteaseAlbumId === albumId)!;
    expect(album.coreGenres).toEqual(["hip-hop"]);
    expect(album.relatedGenres).toEqual([]);
    expect(album.rymRating).toBeNull();
  });

  it.each(catalogAlbums)("publishes $slug with complete NetEase-owned catalog fields", (album) => {
    expect(album.internalId).toBe(`album:${album.neteaseAlbumId}`);
    expect(album.title).not.toBe("");
    expect(album.artists.length).toBeGreaterThan(0);
    const detail = getAlbumDetailBySlug(album.slug);
    expect(detail).not.toBeNull();
    expect(detail!.tracks).toHaveLength(detail!.trackCount);
    expect(detail?.externalUrl).toBe(`https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
    expect(album.cover.kind === "local" ? album.cover.src : album.cover.reason).toBeTruthy();
  });
});
