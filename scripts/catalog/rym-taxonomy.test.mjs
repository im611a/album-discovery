import { describe, expect, it } from "vitest";
import { formatTaxonomyLabel, resolveRymTaxonomy, validateRymTaxonomySnapshot } from "./rym-taxonomy.mjs";

const album = {
  neteaseAlbumId: "1",
  slug: "example",
  title: "Example",
  aliases: ["Example Album"],
  artists: [{ name: "Artist" }],
  releaseDate: "2024-06-01",
  albumType: "album",
};

const record = {
  sourceReference: "manual-snapshot:example",
  titles: ["Example Album"],
  artists: ["Artist"],
  releaseYear: "2024",
  releaseType: "album",
  primaryGenres: [
    { key: "art-pop", labelZh: "艺术流行", labelEn: "Art Pop" },
    { key: "ambient-pop", labelZh: null, labelEn: "Ambient Pop" },
  ],
  secondaryGenres: [
    { key: "chamber-pop", labelZh: "室内流行", labelEn: "Chamber Pop" },
  ],
  descriptors: [
    { key: "lush", labelZh: null, labelEn: "lush" },
    { key: "melodic", labelZh: "旋律性", labelEn: "melodic" },
  ],
};

describe("offline RYM taxonomy resolution", () => {
  it("requires title or alias, artist, release year and release type together", () => {
    for (const changed of [
      { ...record, titles: ["Other"] },
      { ...record, artists: ["Other"] },
      { ...record, artists: ["Artist", "Unrelated Collaborator"] },
      { ...record, releaseYear: "2023" },
      { ...record, releaseType: "ep" },
    ]) {
      expect(resolveRymTaxonomy(album, ["manual-core"], [changed]).audit.status).toBe("unmatched");
    }
  });

  it("requires the complete artist set for multi-artist albums", () => {
    const collaboration = {
      ...album,
      artists: [{ name: "Artist" }, { name: "Collaborator" }],
    };
    expect(resolveRymTaxonomy(collaboration, ["manual-core"], [record]).audit.status).toBe("unmatched");
    expect(resolveRymTaxonomy(collaboration, ["manual-core"], [{ ...record, artists: ["Collaborator", "Artist"] }]).audit.status).toBe("matched");
  });

  it("keeps RYM source order for a unique composite match", () => {
    const result = resolveRymTaxonomy(album, ["manual-core"], [record]);
    expect(result.audit.status).toBe("matched");
    expect(result.taxonomy).toEqual({
      coreGenres: ["art-pop", "ambient-pop"],
      relatedGenres: ["chamber-pop"],
      descriptors: ["lush", "melodic"],
    });
  });

  it("does not guess when more than one record matches", () => {
    const result = resolveRymTaxonomy(album, ["manual-core"], [record, { ...record, sourceReference: "manual-snapshot:duplicate" }]);
    expect(result.audit.status).toBe("ambiguous");
    expect(result.taxonomy).toEqual({ coreGenres: ["manual-core"], relatedGenres: [], descriptors: [] });
  });

  it("keeps only manual core genres when there is no authorized offline record", () => {
    const result = resolveRymTaxonomy(album, ["manual-core"], []);
    expect(result.audit).toMatchObject({ status: "unmatched", reason: "no_authorized_offline_record" });
    expect(result.taxonomy).toEqual({ coreGenres: ["manual-core"], relatedGenres: [], descriptors: [] });
  });

  it("rejects incomplete match evidence and unstable term keys", () => {
    const snapshot = { version: 1, sourceDescription: "User-provided offline file", importedAt: "2026-07-23T00:00:00.000Z" };
    expect(validateRymTaxonomySnapshot({ ...snapshot, records: [{ ...record, releaseYear: null }] })).toContain("records[0] is missing composite match evidence.");
    expect(validateRymTaxonomySnapshot({ ...snapshot, records: [{ ...record, descriptors: [{ key: "Not Stable", labelZh: null, labelEn: "Not Stable" }] }] })).toContain("records[0].descriptors is invalid.");
  });

  it("requires traceable source metadata for a non-empty offline snapshot", () => {
    expect(validateRymTaxonomySnapshot({ version: 1, sourceDescription: "", importedAt: null, records: [record] })).toEqual(expect.arrayContaining([
      "RYM taxonomy snapshot sourceDescription is required.",
      "A non-empty RYM taxonomy snapshot needs a valid UTC importedAt timestamp.",
    ]));
    expect(validateRymTaxonomySnapshot({
      version: 1,
      sourceDescription: "User-provided offline file",
      importedAt: "2026-07-23T00:00:00.000Z",
      records: [record],
    })).toEqual([]);
  });

  it("rejects duplicate and overlapping taxonomy keys without inventing replacements", () => {
    const snapshot = {
      version: 1,
      sourceDescription: "User-provided offline file",
      importedAt: "2026-07-23T00:00:00.000Z",
      records: [{
        ...record,
        primaryGenres: [record.primaryGenres[0], record.primaryGenres[0]],
        secondaryGenres: [record.primaryGenres[0], record.secondaryGenres[0], record.secondaryGenres[0]],
        descriptors: [record.descriptors[0], record.descriptors[0]],
      }],
    };
    expect(validateRymTaxonomySnapshot(snapshot)).toEqual(expect.arrayContaining([
      "records[0].primaryGenres contains duplicate key art-pop.",
      "records[0].secondaryGenres contains duplicate key chamber-pop.",
      "records[0].descriptors contains duplicate key lush.",
      "records[0] repeats art-pop in primaryGenres and secondaryGenres.",
    ]));
  });

  it("uses bilingual labels only when a reliable Chinese label exists", () => {
    expect(formatTaxonomyLabel({ key: "art-pop", labelZh: "艺术流行", labelEn: "Art Pop" })).toBe("艺术流行（Art Pop）");
    expect(formatTaxonomyLabel({ key: "ambient-pop", labelZh: null, labelEn: "Ambient Pop" })).toBe("Ambient Pop");
  });
});
