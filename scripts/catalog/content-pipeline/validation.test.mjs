import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { knownFrozenArtistDebt, validateProposedAlbum } from "./validation.mjs";

const stableCatalogPromise = readFile("src/data/generated/catalog.json", "utf8").then(JSON.parse);

const proposed = (overrides = {}) => ({
  id: "album:999001",
  internalId: "album:999001",
  neteaseAlbumId: "999001",
  slug: "pipeline-record",
  title: "Pipeline Record",
  aliases: [],
  artists: [{ id: "netease-artist:999001", neteaseArtistId: "999001", name: "Pipeline Artist" }],
  releaseDate: "2026-01-01",
  releaseDatePrecision: "day",
  albumType: "album",
  tracks: [
    { id: "netease-track:1", neteaseTrackId: "1", title: "One", discNumber: 1, trackNumber: 1, durationMs: 1000, artists: ["Pipeline Artist"] },
    { id: "netease-track:2", neteaseTrackId: "2", title: "Two", discNumber: 1, trackNumber: 2, durationMs: 1000, artists: ["Pipeline Artist"] },
  ],
  searchText: "Pipeline Record Pipeline Artist",
  ...overrides,
});
const row = (overrides = {}) => ({ albumId: "999001", findings: [], expectedTitle: "Pipeline Record", expectedArtists: ["Pipeline Artist"], coreGenres: ["rock"], contexts: [], refresh: false, ...overrides });

describe("Content Pipeline proposed Album validation", () => {
  it("isolates only the exact frozen Artist ID zero debt", async () => {
    expect(knownFrozenArtistDebt(await stableCatalogPromise)).toEqual({ state: "KNOWN_FROZEN_ARTIST_ID_0_DEBT", count: 1, albumIds: ["281405720"] });
  });

  it("accepts a structurally clean proposed Album", async () => {
    const result = validateProposedAlbum({ row: row(), album: proposed(), catalog: await stableCatalogPromise });
    expect(result.findings).toEqual([]);
  });

  it("detects invalid track IDs, positions and duration", async () => {
    const album = proposed({ tracks: [
      { id: "netease-track:1", neteaseTrackId: "x", title: "One", discNumber: 1, trackNumber: 1, durationMs: -1, artists: ["Pipeline Artist"] },
      { id: "netease-track:1", neteaseTrackId: "2", title: "Two", discNumber: 1, trackNumber: 1, durationMs: 1000, artists: ["Pipeline Artist"] },
    ] });
    const codes = validateProposedAlbum({ row: row(), album, catalog: await stableCatalogPromise }).findings.map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining(["INVALID_TRACK_ID", "DUPLICATE_TRACK_ID", "DUPLICATE_TRACK_POSITION", "INVALID_TRACK_DURATION"]));
  });

  it("requires review for assertion disagreement and slug override/refresh policy", async () => {
    const result = validateProposedAlbum({ row: row({ expectedTitle: "Wrong", expectedArtists: ["Wrong"], refresh: true }), album: proposed(), catalog: await stableCatalogPromise });
    expect(result.findings.map((item) => item.code)).toEqual(expect.arrayContaining(["TITLE_ASSERTION_MISMATCH", "ARTIST_ASSERTION_MISMATCH", "REFRESH_REVIEW_REQUIRED"]));
  });

  it("rejects invalid date precision instead of guessing", async () => {
    const result = validateProposedAlbum({ row: row(), album: proposed({ releaseDate: "2026-02-31", releaseDatePrecision: "month" }), catalog: await stableCatalogPromise });
    expect(result.findings.map((item) => item.code)).toContain("INVALID_RELEASE_DATE");
  });
});
