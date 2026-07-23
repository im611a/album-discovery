import { describe, expect, it } from "vitest";
import { enrichCatalogWithRym, validateRymDatasetEnvelope } from "./rym-enrichment.mjs";

const baseAlbum = {
  neteaseAlbumId: "1",
  title: "Example",
  aliases: ["Example Alias"],
  artists: [{ name: "Artist" }],
  releaseDate: "2020-01-01",
  albumType: "album",
  coreGenres: ["pop"],
};
const dataset = (record) => ({
  version: 2,
  dataset: {
    name: "Synthetic contract fixture",
    source: "local test fixture",
    acquiredAt: "2026-01-01",
    licenseBasis: "test-only synthetic data",
    importedFields: ["rymRating", "rymRatingCount", "primaryGenres", "secondaryGenres"],
  },
  records: [record],
});
const matched = {
  neteaseAlbumId: "1",
  matchStatus: "MATCHED",
  sourceReference: "offline:test:1",
  titles: ["Example"],
  artists: ["Artist"],
  releaseYear: "2020",
  releaseType: "album",
  primaryGenres: [{ key: "art-pop", labelZh: "艺术流行", labelEn: "Art Pop" }],
  secondaryGenres: [{ key: "dream-pop", labelZh: "梦幻流行", labelEn: "Dream Pop" }],
  descriptors: [],
  rymRating: 3.82,
  rymRatingCount: 1842,
  rymObservedAt: "2026-01-01T00:00:00.000Z",
};

describe("optional offline RYM enrichment", () => {
  it("imports a reliable matched rating and independent taxonomy fields", () => {
    const result = enrichCatalogWithRym({ albums: [baseAlbum] }, dataset(matched), "2026-01-02T00:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.catalog.albums[0]).toMatchObject({ rymRating: 3.82, rymRatingCount: 1842, coreGenres: ["art-pop"], relatedGenres: ["dream-pop"], rymMatchStatus: "MATCHED" });
  });

  it("keeps absent ratings as null while allowing verified genres", () => {
    const result = enrichCatalogWithRym({ albums: [baseAlbum] }, dataset({ ...matched, rymRating: null, rymRatingCount: null, rymObservedAt: null }));
    expect(result.ok).toBe(true);
    expect(result.catalog.albums[0].rymRating).toBeNull();
    expect(result.catalog.albums[0].relatedGenres).toEqual(["dream-pop"]);
  });

  it("rejects rating counts without a rating", () => {
    const result = enrichCatalogWithRym({ albums: [baseAlbum] }, dataset({ ...matched, rymRating: null }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("rymRatingCount");
  });

  it("rejects descriptor import declarations because descriptors are not a product field", () => {
    const input = dataset(matched);
    input.dataset.importedFields.push("descriptors");
    expect(validateRymDatasetEnvelope(input).join(" ")).toContain("unsupported field descriptors");
  });

  it("rejects descriptor values from otherwise matched records", () => {
    const input = dataset({ ...matched, descriptors: [{ key: "lush", labelZh: null, labelEn: "lush" }] });
    expect(validateRymDatasetEnvelope(input).join(" ")).toContain("descriptors is unsupported");
  });

  it("rejects non-matched records that attempt to publish RYM fields", () => {
    const input = dataset({ ...matched, matchStatus: "AMBIGUOUS" });
    expect(validateRymDatasetEnvelope(input).join(" ")).toContain("cannot publish");
  });

  it("rejects non-matched descriptors and observation timestamps", () => {
    const input = dataset({
      neteaseAlbumId: "1",
      matchStatus: "NOT_FOUND",
      descriptors: [{ key: "lush", labelZh: null, labelEn: "lush" }],
      rymObservedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(validateRymDatasetEnvelope(input).join(" ")).toContain("cannot publish");
  });

  it("does not match on title alone when the artist differs", () => {
    const result = enrichCatalogWithRym({ albums: [baseAlbum] }, dataset({ ...matched, artists: ["Different Artist"] }));
    expect(result.ok).toBe(true);
    expect(result.catalog.albums[0]).toMatchObject({ rymRating: null, relatedGenres: [], rymMatchStatus: "UNVERIFIED_NO_DATA" });
  });
});
