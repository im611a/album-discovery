import { describe, expect, it } from "vitest";

import {
  validateAlbum,
  validateAlbumAlias,
  validateAlbumArtistCredits,
  validateAlbumSlug,
  validateArtist,
  validateArtistAlias,
  validateCoverAsset,
  validateReleaseCompanyCredits,
  validateTrack,
  validateTrackArtistCredits,
  validateTaxonomyTerm,
  type Album,
  type AlbumArtistCredit,
  type Track,
  type TrackArtistCredit,
} from "@/domain/catalog";
import {
  parseAlbumId,
  parseArtistId,
  parseCoverAssetId,
  parseTaxonomyTermId,
  parseTrackId,
} from "@/domain/ids";
import { parseUtcIsoTimestamp, type UtcIsoTimestamp } from "@/domain/sources";

function valueOf<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Expected a valid test ID.");
  return result.value;
}

function utc(value: string): UtcIsoTimestamp {
  const result = parseUtcIsoTimestamp(value);
  if (!result.ok) throw new Error("Expected a valid UTC test timestamp.");
  return result.value;
}

const albumId = valueOf(parseAlbumId("album-internal-a1"));
const artistA = valueOf(parseArtistId("artist-internal-a1"));
const artistB = valueOf(parseArtistId("artist-internal-a2"));
const trackA = valueOf(parseTrackId("track-internal-a1"));

const album: Album = {
  id: albumId,
  title: "Synthetic Contract Album",
  releaseDate: { year: 2024, month: 7, day: null, precision: "MONTH" },
  albumType: "ALBUM",
  createdAt: utc("2026-07-17T00:00:00.000Z"),
  updatedAt: utc("2026-07-17T00:00:00.000Z"),
};

describe("catalog entities", () => {
  it("accepts a canonical album without country, region, language, or market fields", () => {
    expect(validateAlbum(album)).toEqual([]);
    expect("region" in album).toBe(false);
    expect("language" in album).toBe(false);
    expect("sourceMarketChannel" in album).toBe(false);
  });

  it("rejects blank canonical titles and invalid partial dates", () => {
    const issues = validateAlbum({
      ...album,
      title: " ",
      releaseDate: { year: 2023, month: 2, day: 29, precision: "DAY" },
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["BLANK_VALUE", "INVALID_DATE"]),
    );
  });

  it("propagates every PartialDate and UTC timestamp issue category", () => {
    expect(
      validateAlbum({
        ...album,
        releaseDate: { year: 0, month: null, day: null, precision: "YEAR" },
      }).map((item) => item.code),
    ).toContain("OUT_OF_RANGE");
    expect(
      validateAlbum({
        ...album,
        releaseDate: { year: 2024, month: 1, day: null, precision: "YEAR" },
      }).map((item) => item.code),
    ).toContain("UNEXPECTED_VALUE");
    const invalidDateType = { ...album, releaseDate: "invalid" };
    // @ts-expect-error Runtime validation must reject an invalid value from an untyped boundary.
    expect(validateAlbum(invalidDateType).map((item) => item.code)).toContain("INVALID_TYPE");
    const invalidTimestamp = { ...album, createdAt: "not-a-time" };
    // @ts-expect-error Runtime validation must reject an unbranded event timestamp.
    expect(validateAlbum(invalidTimestamp).map((item) => item.code)).toContain(
      "INVALID_UTC_FORMAT",
    );
  });

  it("accepts AlbumType.UNKNOWN without inventing a source mapping", () => {
    expect(validateAlbum({ ...album, albumType: "UNKNOWN" })).toEqual([]);
  });

  it("rejects blank artist names", () => {
    expect(
      validateArtist({
        id: artistA,
        name: " ",
        createdAt: utc("2026-07-17T00:00:00.000Z"),
        updatedAt: utc("2026-07-17T00:00:00.000Z"),
      }),
    ).toMatchObject([{ path: "name", code: "BLANK_VALUE" }]);
  });

  it("preserves ordered multi-artist album credits without inventing an aggregate artist", () => {
    const credits: readonly AlbumArtistCredit[] = [
      { albumId, artistId: artistA, position: 1, creditedName: null },
      { albumId, artistId: artistB, position: 2, creditedName: "Synthetic Guest Credit" },
    ];
    expect(validateAlbumArtistCredits(credits)).toEqual([]);
    expect(credits.map((credit) => credit.artistId)).toEqual([artistA, artistB]);
  });

  it("keeps track artist credits independent from album artist credits", () => {
    const credits: readonly TrackArtistCredit[] = [
      { trackId: trackA, artistId: artistB, position: 1, creditedName: null },
      { trackId: trackA, artistId: artistA, position: 2, creditedName: null },
    ];
    expect(validateTrackArtistCredits(credits)).toEqual([]);
    expect(credits[0].artistId).toBe(artistB);
  });

  it("rejects duplicate credit positions", () => {
    expect(
      validateAlbumArtistCredits([
        { albumId, artistId: artistA, position: 1, creditedName: null },
        { albumId, artistId: artistB, position: 1, creditedName: null },
      ]).map((item) => item.code),
    ).toContain("DUPLICATE_POSITION");
  });

  it("rejects invalid credit positions", () => {
    expect(
      validateAlbumArtistCredits([
        { albumId, artistId: artistA, position: 0, creditedName: null },
      ]).map((item) => item.code),
    ).toContain("INVALID_POSITION");
  });

  it("validates album and artist alias fields", () => {
    expect(
      validateAlbumAlias({
        id: " ",
        albumId,
        value: "",
        kind: "ALIAS",
        position: 0,
        sourceRecordId: null,
      }).map((item) => item.code),
    ).toEqual(expect.arrayContaining(["BLANK_VALUE", "INVALID_POSITION"]));
    expect(
      validateArtistAlias({
        id: " ",
        artistId: artistA,
        value: "",
        position: 0,
        sourceRecordId: null,
      }).map((item) => item.code),
    ).toEqual(expect.arrayContaining(["BLANK_VALUE", "INVALID_POSITION"]));
  });

  it("enforces the current slug retirement invariant while keeping slug separate from ID", () => {
    expect(
      validateAlbumSlug({
        albumId,
        slug: "synthetic-contract-album",
        isCurrent: true,
        createdAt: utc("2026-07-17T00:00:00.000Z"),
        retiredAt: utc("2026-07-17T01:00:00.000Z"),
      }),
    ).toMatchObject([{ code: "CURRENT_SLUG_RETIRED" }]);
    expect(albumId).not.toBe("synthetic-contract-album");
  });

  it("requires historical slugs to record when they were retired", () => {
    expect(
      validateAlbumSlug({
        albumId,
        slug: "synthetic-historical-title",
        isCurrent: false,
        createdAt: utc("2026-07-17T00:00:00.000Z"),
        retiredAt: null,
      }),
    ).toMatchObject([{ code: "HISTORICAL_SLUG_NOT_RETIRED" }]);
  });
});

describe("track and optional company contracts", () => {
  const track = (id: string, position: number, discNumber: number, trackNumber: number): Track => ({
    id: valueOf(parseTrackId(id)),
    albumId,
    title: `Synthetic Track ${position}`,
    position,
    discNumber,
    trackNumber,
    durationMs: 0,
    createdAt: utc("2026-07-17T00:00:00.000Z"),
    updatedAt: utc("2026-07-17T00:00:00.000Z"),
  });

  it("keeps source disc and track numbers separate from stable album position", () => {
    const discOne = track("track-internal-a1", 1, 1, 1);
    const discTwo = track("track-internal-a2", 2, 2, 1);
    expect(validateTrack(discOne)).toEqual([]);
    expect(validateTrack(discTwo)).toEqual([]);
    expect(discTwo).toMatchObject({ position: 2, discNumber: 2, trackNumber: 1 });
  });

  it("allows a missing source track number while retaining source position", () => {
    expect(validateTrack({ ...track("track-internal-a3", 3, 1, 3), trackNumber: null })).toEqual([]);
  });

  it("rejects invalid track positions and durations", () => {
    const issues = validateTrack({
      ...track("track-internal-a4", 4, 1, 4),
      position: 0,
      durationMs: -1,
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["INVALID_POSITION", "INVALID_DURATION"]),
    );
  });

  it("keeps a missing release company as an empty collection", () => {
    expect(validateReleaseCompanyCredits([])).toEqual([]);
  });

  it("validates release company text and position uniqueness", () => {
    const issues = validateReleaseCompanyCredits([
      { id: "", albumId, displayName: " ", position: 1, sourceRecordId: null },
      { id: "company-a2", albumId, displayName: "Synthetic Label", position: 1, sourceRecordId: null },
    ]);
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["BLANK_VALUE", "DUPLICATE_POSITION"]),
    );
  });
});

describe("cover and taxonomy contracts", () => {
  it("requires an actual remote URL for REMOTE_ONLY cover assets", () => {
    const issues = validateCoverAsset({
      id: valueOf(parseCoverAssetId("cover-internal-a1")),
      albumId,
      source: "NETEASE",
      sourceUrl: null,
      cachedPath: null,
      width: null,
      height: null,
      variant: null,
      status: "REMOTE_ONLY",
      fetchedAt: null,
    });
    expect(issues).toMatchObject([{ code: "MISSING_REMOTE_URL" }]);
  });

  it("requires a cached path for CACHED cover assets", () => {
    const issues = validateCoverAsset({
      id: valueOf(parseCoverAssetId("cover-internal-a2")),
      albumId,
      source: "NETEASE",
      sourceUrl: "https://example.invalid/synthetic-cover.jpg",
      cachedPath: null,
      width: 100,
      height: 100,
      variant: null,
      status: "CACHED",
      fetchedAt: utc("2026-07-17T00:00:00.000Z"),
    });
    expect(issues).toMatchObject([{ code: "MISSING_CACHED_PATH" }]);
  });

  it("uses INVALID_DIMENSION for cover size without changing position errors", () => {
    const coverIssues = validateCoverAsset({
      id: valueOf(parseCoverAssetId("cover-internal-a3")),
      albumId,
      source: "NETEASE",
      sourceUrl: null,
      cachedPath: null,
      width: 0,
      height: -1,
      variant: null,
      status: "UNAVAILABLE",
      fetchedAt: null,
    });
    expect(coverIssues.map((item) => item.code)).toEqual([
      "INVALID_DIMENSION",
      "INVALID_DIMENSION",
    ]);
    expect(coverIssues.map((item) => item.code)).not.toContain("INVALID_POSITION");
  });

  it("keeps RYM taxonomy kind and stable identity explicit", () => {
    expect(
      validateTaxonomyTerm({
        id: valueOf(parseTaxonomyTermId("taxonomy-internal-a1")),
        source: "RYM",
        kind: "PRIMARY_GENRE",
        sourceValue: "Synthetic Genre",
        stableKey: "synthetic-genre",
      }),
    ).toEqual([]);
  });

  it("rejects blank taxonomy source and stable values", () => {
    expect(
      validateTaxonomyTerm({
        id: valueOf(parseTaxonomyTermId("taxonomy-internal-a2")),
        source: "RYM",
        kind: "DESCRIPTOR",
        sourceValue: " ",
        stableKey: "",
      }).map((item) => item.code),
    ).toEqual(["BLANK_VALUE", "BLANK_VALUE"]);
  });
});
