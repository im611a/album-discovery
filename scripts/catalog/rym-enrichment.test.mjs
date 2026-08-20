import { describe, expect, it } from "vitest";
import { buildRymEnrichment, reconcileRymSummaryWithCatalog } from "./rym-enrichment.mjs";

const album = {
  internalId: "album:1", id: "album:1", neteaseAlbumId: "1", slug: "example",
  title: "Example", aliases: ["示例"], artists: [{ id: "artist:2", neteaseArtistId: "2", name: "Artist" }],
  releaseDate: "2020-01-01", albumType: "album", coreGenres: ["pop"], relatedGenres: [], descriptors: [],
  rymRating: null, rymRatingCount: null, rymReference: null, rymObservedAt: null, rymInputSourceId: null,
  rymMatchStatus: "UNVERIFIED_NO_DATA",
};
const catalog = {
  taxonomy: [{ key: "pop", labelZh: "流行", labelEn: "Pop", kind: "core" }],
  descriptorTaxonomy: [],
  albums: [album],
};
const row = {
  rowNumber: 1, title: "Example", artist: "Artist", releaseYear: "2020", releaseType: "album",
  rating: 3.82, ratingCount: 1842, primaryGenres: ["Pop"], secondaryGenres: ["Dream Pop"],
  descriptors: ["lush"], reference: "offline:row:1",
};
const options = { inputSourceId: "fixture", inputSha256: "abc", observedAt: "2026-01-01T00:00:00.000Z" };

describe("bulk RYM enrichment", () => {
  it("publishes exact ratings and Secondary Genres without descriptors or core replacement", () => {
    const result = buildRymEnrichment(catalog, [row], options);
    expect(result.catalog.albums[0]).toMatchObject({
      rymRating: 3.82,
      rymRatingCount: 1842,
      rymMatchStatus: "MATCHED_EXACT",
      rymInputSourceId: "fixture",
      coreGenres: ["pop"],
      relatedGenres: ["dream-pop"],
      descriptors: [],
    });
    expect(result.summary).toMatchObject({ MATCHED_EXACT: 1, ratedAlbumCount: 1, relatedGenreAlbumCount: 1, coreGenreAdjustmentCount: 0 });
  });

  it("allows related genres when rating values are absent", () => {
    const result = buildRymEnrichment(catalog, [{ ...row, rating: null, ratingCount: null }], options);
    expect(result.catalog.albums[0]).toMatchObject({ rymRating: null, relatedGenres: ["dream-pop"], rymMatchStatus: "MATCHED_EXACT" });
  });

  it("rejects invalid ratings and rating counts", () => {
    for (const changed of [{ rating: 0 }, { rating: 5.1 }, { ratingCount: -1 }, { ratingCount: 1.5 }]) {
      const result = buildRymEnrichment(catalog, [{ ...row, ...changed }], options);
      expect(result.catalog.albums[0].rymMatchStatus).toBe("REJECTED");
      expect(result.catalog.albums[0].rymRating).toBeNull();
    }
  });

  it("is idempotent for the same input", () => {
    const once = buildRymEnrichment(catalog, [row], options);
    const twice = buildRymEnrichment(once.catalog, [row], options);
    expect(twice.catalog).toEqual(once.catalog);
  });

  it("keeps ambiguous records empty", () => {
    const duplicate = { ...row, rowNumber: 2, reference: "offline:row:2" };
    const result = buildRymEnrichment(catalog, [row, duplicate], options);
    expect(result.catalog.albums[0]).toMatchObject({ rymRating: null, relatedGenres: [], rymMatchStatus: "AMBIGUOUS" });
  });

  it("reconciles new current-catalog Albums only as truthful UNVERIFIED_NO_DATA results", () => {
    const existing = buildRymEnrichment(catalog, [row], options);
    const addedAlbum = { ...structuredClone(album), internalId: "album:3", id: "album:3", neteaseAlbumId: "3", slug: "added" };
    const priorSummary = { ...existing.summary, results: existing.results };
    const reconciled = reconcileRymSummaryWithCatalog(priorSummary, { ...catalog, albums: [existing.catalog.albums[0], addedAlbum] });
    expect(reconciled.added).toEqual([{
      neteaseAlbumId: "3",
      slug: "added",
      status: "UNVERIFIED_NO_DATA",
      reason: "no_authorized_offline_record",
      inputRow: null,
      sourceReference: null,
    }]);
    expect(reconciled.summary).toMatchObject({ totalAlbums: 2, MATCHED_EXACT: 1, UNVERIFIED_NO_DATA: 1, ratedAlbumCount: 1 });
    expect(reconciled.summary.results[0]).toEqual(priorSummary.results[0]);
  });

  it("refuses to invent a reconciliation decision for an enriched Album missing from the report", () => {
    const priorSummary = { ...buildRymEnrichment(catalog, [], options).summary, results: [] };
    const changed = { ...structuredClone(album), rymMatchStatus: "MATCHED_EXACT", rymRating: 4 };
    expect(() => reconcileRymSummaryWithCatalog(priorSummary, { ...catalog, albums: [changed] })).toThrow("requires an authorized RYM enrichment decision");
  });
});
