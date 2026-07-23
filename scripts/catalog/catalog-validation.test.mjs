import { describe, expect, it } from "vitest";
import catalog from "../../src/data/generated/catalog.json" with { type: "json" };
import identities from "./netease-identities.json" with { type: "json" };
import { validateCatalogData } from "./catalog-validation.mjs";

const clone = () => structuredClone(catalog);

describe("NetEase catalog validation", () => {
  it("accepts the published snapshot", () => {
    const result = validateCatalogData(catalog, identities);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary.albums).toBe(catalog.albums.length);
  });

  it("rejects duplicate NetEase album IDs", () => {
    const changed = clone();
    changed.albums[1].neteaseAlbumId = changed.albums[0].neteaseAlbumId;
    expect(validateCatalogData(changed, identities).errors).toContain(`Duplicate NetEase album ID: ${changed.albums[0].neteaseAlbumId}`);
  });

  it("rejects an outbound URL that does not match its album ID", () => {
    const changed = clone();
    changed.albums[0].externalUrl = "https://music.163.com/#/album?id=1";
    expect(validateCatalogData(changed, identities).errors.some((issue) => issue.includes("external URL"))).toBe(true);
  });

  it("rejects legacy MusicBrainz production fields", () => {
    const changed = clone();
    changed.albums[0].musicbrainzReleaseGroupId = "legacy";
    expect(validateCatalogData(changed, identities).errors.some((issue) => issue.includes("musicbrainzReleaseGroupId"))).toBe(true);
  });

  it("rejects invalid dates and unknown taxonomy keys", () => {
    const changed = clone();
    changed.albums[0].releaseDate = "2025-02-29";
    changed.albums[0].coreGenres = ["invented-genre"];
    const errors = validateCatalogData(changed, identities).errors;
    expect(errors.some((issue) => issue.includes("invalid release date"))).toBe(true);
    expect(errors.some((issue) => issue.includes("unknown core genre"))).toBe(true);
  });

  it("requires both named Chinese acceptance samples", () => {
    const changed = clone();
    changed.albums = changed.albums.filter((album) => album.neteaseAlbumId !== "287974232");
    expect(validateCatalogData(changed, identities).errors).toContain("Required NetEase sample is missing: 艾志恒Asen / 在雨后醒来.");
  });
});
