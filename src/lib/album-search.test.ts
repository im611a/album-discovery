import { describe, expect, it } from "vitest";

import { albumsMock, type MockAlbum } from "@/data/albums.mock";

import { searchAlbums } from "./album-search";

function makeAlbum(id: string, patch: Partial<MockAlbum> = {}): MockAlbum {
  return {
    ...albumsMock[0],
    id,
    slug: id,
    title: `Album ${id}`,
    aliases: [],
    artists: [`Artist ${id}`],
    releaseDate: "2024-01-01",
    primaryGenres: ["Test Genre"],
    secondaryGenres: [],
    descriptors: [],
    ...patch,
  };
}

describe("album search", () => {
  it("returns no results for an empty query", () => {
    expect(searchAlbums(albumsMock, "")).toEqual([]);
  });

  it("returns no results for a whitespace-only query", () => {
    expect(searchAlbums(albumsMock, "   ")).toEqual([]);
  });

  it("matches an exact Chinese album title", () => {
    const [result] = searchAlbums(albumsMock, "纸上月光");

    expect(result.album.id).toBe("mock-001");
    expect(result.matchReason).toBe("title-exact");
  });

  it("matches an exact English title without case sensitivity", () => {
    const [result] = searchAlbums(albumsMock, "BEFORE THE RAIN");

    expect(result.album.id).toBe("mock-002");
    expect(result.matchReason).toBe("title-exact");
  });

  it("matches an exact album alias", () => {
    const [result] = searchAlbums(albumsMock, "雨前");

    expect(result.album.id).toBe("mock-002");
    expect(result.matchReason).toBe("alias-exact");
  });

  it("matches an exact artist name", () => {
    const [result] = searchAlbums(albumsMock, "June Atlas");

    expect(result.album.id).toBe("mock-002");
    expect(result.matchReason).toBe("artist-exact");
  });

  it("matches part of an album title", () => {
    const [result] = searchAlbums(albumsMock, "Rain");

    expect(result.album.id).toBe("mock-002");
    expect(result.matchReason).toBe("title-partial");
  });

  it("matches part of an album alias", () => {
    const [result] = searchAlbums(albumsMock, "Moonlight");

    expect(result.album.id).toBe("mock-001");
    expect(result.matchReason).toBe("alias-partial");
  });

  it("matches part of an artist name", () => {
    const [result] = searchAlbums(albumsMock, "Atlas");

    expect(result.album.id).toBe("mock-002");
    expect(result.matchReason).toBe("artist-partial");
  });

  it("uses the six required match priorities", () => {
    const results = searchAlbums(
      [
        makeAlbum("artist-partial", { artists: ["The Echo Ensemble"] }),
        makeAlbum("alias-partial", { aliases: ["An Echo Room"] }),
        makeAlbum("title-partial", { title: "Echo Chamber" }),
        makeAlbum("artist-exact", { artists: ["Echo"] }),
        makeAlbum("alias-exact", { aliases: ["Echo"] }),
        makeAlbum("title-exact", { title: "Echo" }),
      ],
      "echo",
    );

    expect(results.map((result) => result.matchReason)).toEqual([
      "title-exact",
      "alias-exact",
      "artist-exact",
      "title-partial",
      "alias-partial",
      "artist-partial",
    ]);
    expect(results.map((result) => result.matchPriority)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("sorts matches in the same priority by release date descending", () => {
    const results = searchAlbums(
      [
        makeAlbum("older", { title: "Echo Older", releaseDate: "2022-01-01" }),
        makeAlbum("newer", { title: "Echo Newer", releaseDate: "2025-01-01" }),
      ],
      "echo",
    );

    expect(results.map((result) => result.album.id)).toEqual(["newer", "older"]);
  });

  it("sorts matching dates by title with the zh-CN locale", () => {
    const results = searchAlbums(
      [
        makeAlbum("b", { title: "Echo B" }),
        makeAlbum("a", { title: "Echo A" }),
      ],
      "echo",
    );

    expect(results.map((result) => result.album.title)).toEqual(["Echo A", "Echo B"]);
  });

  it("returns one result when several fields on one album match", () => {
    const album = makeAlbum("multi", {
      title: "Echo",
      aliases: ["Echo"],
      artists: ["Echo"],
    });

    expect(searchAlbums([album], "echo")).toHaveLength(1);
  });

  it("keeps the highest-priority reason for a multi-field match", () => {
    const album = makeAlbum("highest", {
      title: "An Echo Story",
      aliases: ["Echo"],
      artists: ["Echo Collective"],
    });
    const [result] = searchAlbums([album], "echo");

    expect(result.matchReason).toBe("alias-exact");
    expect(result.matchPriority).toBe(2);
  });

  it("does not search genre fields", () => {
    expect(searchAlbums([albumsMock[5]], "Dream Pop")).toEqual([]);
  });

  it("does not search descriptor fields", () => {
    expect(searchAlbums([albumsMock[3]], "nocturnal")).toEqual([]);
  });

  it("does not search track-like extra fields", () => {
    const albumWithTracks = {
      ...albumsMock[0],
      tracks: [{ title: "Hidden Needle" }],
    };

    expect(searchAlbums([albumWithTracks], "Hidden Needle")).toEqual([]);
  });

  it("does not change the input array order", () => {
    const albums = [albumsMock[5], albumsMock[0], albumsMock[1]];
    const originalOrder = [...albums];

    searchAlbums(albums, "a");

    expect(albums).toEqual(originalOrder);
  });

  it("does not modify MockAlbum objects", () => {
    const albums = [structuredClone(albumsMock[0])];
    const snapshot = structuredClone(albums);

    searchAlbums(albums, "纸上");

    expect(albums).toEqual(snapshot);
  });

  it("only returns albums from the provided array", () => {
    const providedAlbums = [albumsMock[1]];
    const results = searchAlbums(providedAlbums, "rain");

    expect(results.every((result) => providedAlbums.includes(result.album))).toBe(true);
  });

  it("places invalid release dates after valid dates predictably", () => {
    const results = searchAlbums(
      [
        makeAlbum("invalid-b", { title: "Echo B", releaseDate: "unknown" }),
        makeAlbum("valid", { title: "Echo Valid", releaseDate: "2020-01-01" }),
        makeAlbum("invalid-a", { title: "Echo A", releaseDate: "not-a-date" }),
      ],
      "echo",
    );

    expect(results.map((result) => result.album.id)).toEqual([
      "valid",
      "invalid-a",
      "invalid-b",
    ]);
  });
});
