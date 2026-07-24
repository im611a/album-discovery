import { describe, expect, it } from "vitest";
import { catalogAlbums } from "./published-catalog";
import { getArtistRelayAlbums, getSeededRandomAlbum, getSimilarAlbums, seededIndex, SIMILARITY_WEIGHTS } from "./exploration";

describe("album exploration engine", () => {
  const source = catalogAlbums.find((album) => album.slug === "ok-computer") ?? catalogAlbums[0];

  it("is deterministic and never returns the source album", () => {
    const first = getSimilarAlbums(source);
    const second = getSimilarAlbums(source);
    expect(first).toEqual(second);
    expect(first.every((item) => item.album.id !== source.id)).toBe(true);
  });

  it("excludes dismissed albums and limits repeated artists", () => {
    const initial = getSimilarAlbums(source);
    const dismissed = initial[0]?.album.id;
    const next = getSimilarAlbums(source, { dismissedAlbumIds: dismissed ? [dismissed] : [] });
    expect(next.some((item) => item.album.id === dismissed)).toBe(false);
    expect(new Set(next.map((item) => item.album.artists[0]?.id)).size).toBe(next.length);
  });

  it("derives every reason from a real scoring contribution", () => {
    for (const item of getSimilarAlbums(source)) {
      expect(item.contributions.coreGenres.length + item.contributions.relatedGenres.length).toBeGreaterThan(0);
      expect(item.reason).toMatch(/共享核心流派|共享相关流派/);
      expect(item.reason).not.toMatch(/AI|热门|%|评分/);
    }
  });

  it("does not include RYM ratings in similarity weights", () => {
    expect(SIMILARITY_WEIGHTS).not.toHaveProperty("rymRating");
  });

  it("uses a stable shareable seed", () => {
    expect(seededIndex("12345", catalogAlbums.length)).toBe(seededIndex("12345", catalogAlbums.length));
    expect(getSeededRandomAlbum("12345")?.id).toBe(getSeededRandomAlbum("12345")?.id);
  });

  it("builds artist relays from shared catalog genres without repeating the source artist", () => {
    const artistId = source.artists[0]?.id;
    const relay = getArtistRelayAlbums(artistId);
    expect(relay.every((album) => !album.artists.some((artist) => artist.id === artistId))).toBe(true);
    expect(relay.every((album) => album.coreGenres.some((genre) => source.coreGenres.includes(genre)))).toBe(true);
  });
});
