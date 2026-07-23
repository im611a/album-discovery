import { describe, expect, it } from "vitest";
import { discoverAlbums, getAlbumBySlug, getRelatedAlbums, normalizeSearchText, searchAlbums } from "./queries";

describe("catalog queries", () => {
  it("finds Chinese and Latin text across title, artist, genre, descriptor and context", () => {
    expect(searchAlbums("王菲").some((album) => album.slug === "fuzao")).toBe(true);
    expect(searchAlbums("RADIOHEAD").some((album) => album.slug === "ok-computer")).toBe(true);
    expect(searchAlbums("梦幻流行").length).toBeGreaterThan(0);
    expect(searchAlbums("夜晚").length).toBeGreaterThan(0);
  });
  it("normalizes whitespace and diacritics", () => {
    expect(normalizeSearchText("  ÁGÆTIS   BYRJUN ")).toBe("agætis byrjun");
    expect(searchAlbums("  ok   computer ")[0]?.slug).toBe("ok-computer");
  });
  it("combines real filters and returns accurate results", () => {
    const results = discoverAlbums({ coreGenre: "dream-pop", descriptor: "hazy" }, "release-newest");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((album) => album.coreGenres.includes("dream-pop") && album.descriptors.includes("hazy"))).toBe(true);
  });
  it("uses stable real identities for detail and related queries", () => {
    const album = getAlbumBySlug("ok-computer");
    expect(album?.title).toBe("OK Computer");
    expect(album && getRelatedAlbums(album)).toHaveLength(6);
  });
});
