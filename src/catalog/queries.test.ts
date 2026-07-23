import { describe, expect, it } from "vitest";
import { buildDiscoverOptions, discoverAlbums, getAlbumBySlug, getAllAlbums, getRelatedAlbums, normalizeSearchText, searchAlbums } from "./queries";

describe("catalog queries", () => {
  it("finds Chinese and Latin text across title, alias and artist", () => {
    expect(searchAlbums("王菲").some((album) => album.slug === "fuzao")).toBe(true);
    expect(searchAlbums("RADIOHEAD").some((album) => album.slug === "ok-computer")).toBe(true);
    expect(searchAlbums("Yeh Hui–mei").some((album) => album.slug === "ye-hui-mei")).toBe(true);
  });
  it("normalizes whitespace and diacritics", () => {
    expect(normalizeSearchText("  ÁGÆTIS   BYRJUN ")).toBe("agætis byrjun");
    expect(searchAlbums("  ok   computer ")[0]?.slug).toBe("ok-computer");
  });
  it("combines only currently published filters and returns accurate results", () => {
    const results = discoverAlbums({ coreGenre: "dream-pop", context: "夜晚" }, "release-newest");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((album) => album.coreGenres.includes("dream-pop") && album.contexts.includes("夜晚"))).toBe(true);
    expect(buildDiscoverOptions()).toMatchObject({ relatedGenres: [], descriptors: [] });
    expect(discoverAlbums({ relatedGenre: "legacy-related", descriptor: "legacy-descriptor" })).toEqual([]);
  });
  it("builds optional taxonomy choices only from values present on published albums", () => {
    const album = getAllAlbums()[0];
    const enriched = { ...album, relatedGenres: ["dream-pop", "dream-pop"], descriptors: ["lush", "lush"] };
    const other = { ...getAllAlbums()[1], relatedGenres: ["chamber-pop"], descriptors: ["melodic"] };
    const options = buildDiscoverOptions([enriched, other]);
    expect(options.relatedGenres).toEqual(["chamber-pop", "dream-pop"]);
    expect(options.descriptors).toEqual(["lush", "melodic"]);
    expect(discoverAlbums({ relatedGenre: "dream-pop", descriptor: "lush" }, "title", [enriched, other])).toEqual([enriched]);
  });
  it("uses stable real identities for detail and related queries", () => {
    const album = getAlbumBySlug("ok-computer");
    expect(album?.title).toBe("OK Computer");
    expect(album && getRelatedAlbums(album)).toHaveLength(6);
  });
});
