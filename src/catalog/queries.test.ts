import { describe, expect, it } from "vitest";
import { discoverAlbums, getAlbumBySlug, getRelatedAlbums, normalizeSearchText, searchAlbums } from "./queries";

describe("catalog queries", () => {
  it("finds Chinese and Latin text across title, artist, genre, descriptor and context", () => {
    expect(searchAlbums("王菲").some((album) => album.slug === "fuzao")).toBe(true);
    expect(searchAlbums("RADIOHEAD").some((album) => album.slug === "in-rainbows")).toBe(true);
    expect(searchAlbums("朦胧").length).toBeGreaterThan(0);
    expect(searchAlbums("夜晚").length).toBeGreaterThan(0);
  });
  it("normalizes whitespace and diacritics", () => {
    expect(normalizeSearchText("  ÁGÆTIS   BYRJUN ")).toBe("agætis byrjun");
    expect(searchAlbums("  in   rainbows ")[0]?.slug).toBe("in-rainbows");
  });
  it("combines real filters and returns accurate results", () => {
    const results = discoverAlbums({ primaryGenre: "dream-pop", descriptor: "朦胧" }, "release-newest");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((album) => album.primaryGenres.includes("dream-pop") && album.descriptors.includes("朦胧"))).toBe(true);
  });
  it("uses stable real identities for detail and related queries", () => {
    const album = getAlbumBySlug("in-rainbows");
    expect(album?.title).toBe("In Rainbows");
    expect(album && getRelatedAlbums(album)).toHaveLength(6);
  });
});
