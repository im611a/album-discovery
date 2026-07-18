import { describe, expect, expectTypeOf, it } from "vitest";

import { parseAlbumId, parseArtistId, parseTrackId } from "@/domain/ids";
import { parseUtcIsoTimestamp, type UtcIsoTimestamp } from "@/domain/sources";
import {
  validateAlbumSummary,
  type AlbumDetail,
  type AlbumSearchResult,
  type AlbumSummary,
  type NewReleaseAlbumSummary,
} from "@/domain/read-models";

function valueOf<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Expected a valid test ID.");
  return result.value;
}

function utc(value: string): UtcIsoTimestamp {
  const result = parseUtcIsoTimestamp(value);
  if (!result.ok) throw new Error("Expected a valid UTC test timestamp.");
  return result.value;
}

const summary: AlbumSummary = {
  id: valueOf(parseAlbumId("album-internal-a1")),
  origin: "PUBLISHED_SOURCE_DATA",
  slug: "synthetic-contract-album",
  title: "Synthetic Contract Album",
  artists: [{ id: valueOf(parseArtistId("artist-internal-a1")), name: "Synthetic Artist" }],
  releaseDate: { year: 2024, month: null, day: null, precision: "YEAR" },
  releaseYear: 2024,
  releaseType: "ALBUM",
  cover: { kind: "PLACEHOLDER", url: null, alt: "Synthetic cover unavailable" },
  rym: null,
  primaryGenres: [],
};

describe("read model contracts", () => {
  it("accepts explicit null and empty collection semantics without undefined values", () => {
    expect(validateAlbumSummary(summary)).toEqual([]);
    expect(JSON.stringify(summary)).not.toContain("undefined");
  });

  it("rejects a convenience release year that disagrees with PartialDate", () => {
    expect(validateAlbumSummary({ ...summary, releaseYear: 2023 })).toMatchObject([
      { code: "RELEASE_YEAR_MISMATCH" },
    ]);
  });

  it("reports blank identity text and invalid RYM values", () => {
    const issues = validateAlbumSummary({
      ...summary,
      title: " ",
      slug: "",
      rym: { score: Number.NaN, ratingCount: -1, observedAt: null },
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "BLANK_TITLE",
        "BLANK_SLUG",
        "INVALID_RATING",
        "INVALID_RATING_COUNT",
      ]),
    );
  });

  it("keeps prototype artwork behind an explicit origin-aware read-model variant", () => {
    const prototype: AlbumSummary = {
      ...summary,
      origin: "PROTOTYPE_FIXTURE",
      cover: {
        kind: "PROTOTYPE_ARTWORK",
        alt: "Synthetic artwork",
        accent: "synthetic-accent",
        background: "synthetic-background",
        motif: "synthetic-motif",
      },
    };
    expect(prototype.cover.kind).toBe("PROTOTYPE_ARTWORK");
  });

  it("rejects prototype artwork from published source projections", () => {
    expect(
      validateAlbumSummary({
        ...summary,
        cover: {
          kind: "PROTOTYPE_ARTWORK",
          alt: "Synthetic artwork",
          accent: "synthetic-accent",
          background: "synthetic-background",
          motif: "synthetic-motif",
        },
      }),
    ).toMatchObject([{ code: "PROTOTYPE_COVER_IN_PUBLISHED_DATA" }]);
  });

  it("defines detail, new-release, and search projections without provider DTOs", () => {
    expectTypeOf<AlbumDetail>().toMatchTypeOf<AlbumSummary>();
    expectTypeOf<NewReleaseAlbumSummary>().toMatchTypeOf<AlbumSummary>();
    expectTypeOf<AlbumSearchResult["matchReason"]>().toEqualTypeOf<
      | "TITLE_EXACT"
      | "ALIAS_EXACT"
      | "ARTIST_EXACT"
      | "TITLE_PARTIAL"
      | "ALIAS_PARTIAL"
      | "ARTIST_PARTIAL"
    >();
  });

  it("uses explicit empty and null values for missing detail fields", () => {
    const detail: AlbumDetail = {
      ...summary,
      aliases: [],
      releaseCompanies: [],
      secondaryGenres: [],
      descriptors: [],
      tracks: [
        {
          id: valueOf(parseTrackId("track-internal-a1")),
          title: "Synthetic Track",
          position: 1,
          discNumber: null,
          trackNumber: null,
          artists: [],
          durationMs: null,
        },
      ],
      neteaseOutboundUrl: null,
      sourceUpdatedAt: null,
    };
    expect(detail.releaseCompanies).toEqual([]);
    expect(detail.rym).toBeNull();
    expect(detail.cover.kind).toBe("PLACEHOLDER");
    expect(detail.neteaseOutboundUrl).toBeNull();
  });

  it("separates taxonomy stable keys from source and display text", () => {
    const withTaxonomy: AlbumSummary = {
      ...summary,
      primaryGenres: [
        {
          key: "synthetic-stable-key",
          sourceValue: "Synthetic Source Label",
          displayLabel: "合成显示标签",
        },
      ],
    };
    expect(withTaxonomy.primaryGenres[0]).toEqual({
      key: "synthetic-stable-key",
      sourceValue: "Synthetic Source Label",
      displayLabel: "合成显示标签",
    });
  });

  it("uses first and last discovery times without an ambiguous single timestamp", () => {
    const newRelease: NewReleaseAlbumSummary = {
      ...summary,
      sourceMarketChannels: ["ZH", "EA"],
      firstDiscoveredAt: utc("2026-07-17T00:00:00.000Z"),
      lastDiscoveredAt: utc("2026-07-17T01:00:00.000Z"),
    };
    expect(newRelease.firstDiscoveredAt).not.toBe(newRelease.lastDiscoveredAt);
    expect(Object.keys(newRelease)).not.toContain("discoveredAt");
    expect(newRelease.firstDiscoveredAt).toBeDefined();
    expect(newRelease.lastDiscoveredAt).toBeDefined();
    expect(JSON.stringify(newRelease)).not.toContain("undefined");
  });
});
