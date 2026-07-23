import { describe, expect, it } from "vitest";
import catalog from "../../src/data/generated/catalog.json" with { type: "json" };
import identities from "./netease-identities.json" with { type: "json" };
import rymSnapshot from "./rym-taxonomy-snapshot.json" with { type: "json" };
import { validateCatalogData } from "./catalog-validation.mjs";

const clone = () => structuredClone(catalog);

describe("NetEase catalog validation", () => {
  it("accepts the published snapshot", () => {
    const result = validateCatalogData(catalog, identities, rymSnapshot);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary.albums).toBe(catalog.albums.length);
  });

  it("rejects duplicate NetEase album IDs", () => {
    const changed = clone();
    changed.albums[1].neteaseAlbumId = changed.albums[0].neteaseAlbumId;
    expect(validateCatalogData(changed, identities, rymSnapshot).errors).toContain(`Duplicate NetEase album ID: ${changed.albums[0].neteaseAlbumId}`);
  });

  it("rejects an outbound URL that does not match its album ID", () => {
    const changed = clone();
    changed.albums[0].externalUrl = "https://music.163.com/#/album?id=1";
    expect(validateCatalogData(changed, identities, rymSnapshot).errors.some((issue) => issue.includes("external URL"))).toBe(true);
  });

  it("rejects legacy MusicBrainz production fields", () => {
    const changed = clone();
    changed.albums[0].musicbrainzReleaseGroupId = "legacy";
    expect(validateCatalogData(changed, identities, rymSnapshot).errors.some((issue) => issue.includes("musicbrainzReleaseGroupId"))).toBe(true);
  });

  it("rejects invalid dates and unknown taxonomy keys", () => {
    const changed = clone();
    changed.albums[0].releaseDate = "2025-02-29";
    changed.albums[0].coreGenres = ["invented-genre"];
    const errors = validateCatalogData(changed, identities, rymSnapshot).errors;
    expect(errors.some((issue) => issue.includes("invalid release date"))).toBe(true);
    expect(errors.some((issue) => issue.includes("unknown core genre"))).toBe(true);
  });

  it("rejects secondary genres and descriptors that are not resolved from the offline RYM snapshot", () => {
    const changed = clone();
    changed.taxonomy.push({ key: "invented-related", labelZh: null, labelEn: "Invented Related", kind: "related" });
    changed.descriptorTaxonomy.push({ key: "invented-trait", labelZh: null, labelEn: "invented trait", kind: "descriptor" });
    changed.albums[0].relatedGenres = ["invented-related"];
    changed.albums[0].descriptors = ["invented-trait"];
    expect(validateCatalogData(changed, identities, rymSnapshot).errors).toContain(
      `${changed.albums[0].slug}: published taxonomy does not match the unique offline RYM record or manual-core fallback.`,
    );
  });

  it("accepts only the exact ordered taxonomy from a unique composite RYM match", () => {
    const changed = clone();
    const album = changed.albums[0];
    const snapshot = {
      version: 1,
      records: [{
        sourceReference: "manual-snapshot:acceptance",
        titles: [album.title],
        artists: album.artists.map((artist) => artist.name),
        releaseYear: album.releaseDate.slice(0, 4),
        releaseType: album.albumType,
        primaryGenres: [{ key: "verified-primary", labelZh: null, labelEn: "Verified Primary" }],
        secondaryGenres: [{ key: "verified-secondary", labelZh: null, labelEn: "Verified Secondary" }],
        descriptors: [{ key: "verified-descriptor", labelZh: null, labelEn: "verified descriptor" }],
      }],
    };
    changed.taxonomy.push(
      { key: "verified-primary", labelZh: null, labelEn: "Verified Primary", kind: "core" },
      { key: "verified-secondary", labelZh: null, labelEn: "Verified Secondary", kind: "related" },
    );
    changed.descriptorTaxonomy.push({ key: "verified-descriptor", labelZh: null, labelEn: "verified descriptor", kind: "descriptor" });
    album.coreGenres = ["verified-primary"];
    album.relatedGenres = ["verified-secondary"];
    album.descriptors = ["verified-descriptor"];
    expect(validateCatalogData(changed, identities, snapshot).errors).toEqual([]);

    album.relatedGenres = ["invented-related"];
    changed.taxonomy.push({ key: "invented-related", labelZh: null, labelEn: "Invented Related", kind: "related" });
    expect(validateCatalogData(changed, identities, snapshot).errors).toContain(
      `${album.slug}: published taxonomy does not match the unique offline RYM record or manual-core fallback.`,
    );
  });

  it("requires both named Chinese acceptance samples", () => {
    const changed = clone();
    changed.albums = changed.albums.filter((album) => album.neteaseAlbumId !== "287974232");
    expect(validateCatalogData(changed, identities, rymSnapshot).errors).toContain("Required NetEase sample is missing: 艾志恒Asen / 在雨后醒来.");
  });
});
