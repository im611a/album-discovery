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
    const results = discoverAlbums({ coreGenre: "dream-pop", context: "night" }, "release-newest");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((album) => album.coreGenres.includes("dream-pop") && album.contexts.includes("night"))).toBe(true);
    expect(buildDiscoverOptions().relatedGenres.length).toBeGreaterThan(0);
    expect(discoverAlbums({ relatedGenre: "legacy-related" })).toEqual([]);
  });
  it("builds optional taxonomy choices only from values present on published albums", () => {
    const album = getAllAlbums()[0];
    const enriched = { ...album, relatedGenres: ["dream-pop", "dream-pop"] };
    const other = { ...getAllAlbums()[1], relatedGenres: ["chamber-pop"] };
    const options = buildDiscoverOptions([enriched, other]);
    expect(options.relatedGenres).toEqual(["chamber-pop", "dream-pop"]);
    expect(discoverAlbums({ relatedGenre: "dream-pop" }, "title", [enriched, other])).toEqual([enriched]);
  });
  it("uses stable real identities for detail and related queries", () => {
    const album = getAlbumBySlug("ok-computer");
    expect(album?.title).toBe("OK Computer");
    expect(album && getRelatedAlbums(album)).toHaveLength(6);
  });
  it("produces a stable discovery order without dropping catalog identities", () => {
    const first = discoverAlbums({}, "random");
    const replay = discoverAlbums({}, "random");
    expect(first.map((album) => album.id)).toEqual(replay.map((album) => album.id));
    expect(new Set(first.map((album) => album.id))).toEqual(new Set(getAllAlbums().map((album) => album.id)));
    expect(first.map((album) => album.id)).not.toEqual(getAllAlbums().map((album) => album.id));
  });
});
