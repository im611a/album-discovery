import { describe, expect, it } from "vitest";
import catalog from "../../src/data/generated/catalog.json" with { type: "json" };
import identities from "./verified-identities.json" with { type: "json" };
import { validateCatalog } from "./catalog-validation.mjs";

const clone = (value) => structuredClone(value);
const issueFor = (value, slug, field) => {
  const index = value.albums.findIndex((album) => album.slug === slug);
  return validateCatalog(value, identities).some((issue) => issue.path === `albums[${index}].${field}`);
};

describe("catalog identity validation", () => {
  it("accepts the published fixed snapshot", () => expect(validateCatalog(catalog, identities)).toEqual([]));

  it.each([
    ["paranoid", "0a4484de-f894-4629-bf81-cf30f27bd8c4", "musicbrainzReleaseGroupId"],
    ["hounds-of-love", "ecc129fd-419f-49ef-ac02-391cd8ef5c39", "musicbrainzReleaseGroupId"],
    ["whats-going-on", "ef15d15b-85e5-45b1-b143-493d71374281", "musicbrainzReleaseGroupId"],
    ["is-this-it", "6d44b57a-2b9d-372a-b7c2-c670dca997d3", "musicbrainzReleaseGroupId"],
    ["since-i-left-you", "d8a6d224-acf2-4be9-ab4d-26ea4545d43c", "musicbrainzReleaseGroupId"],
  ])("rejects the known wrong %s release-group", (slug, wrongId, field) => {
    const changed = clone(catalog);
    const album = changed.albums.find((item) => item.slug === slug);
    album.musicbrainzReleaseGroupId = wrongId;
    album.id = `mb:${wrongId}`;
    expect(issueFor(changed, slug, field)).toBe(true);
  });

  it("rejects a flagship with an implausibly short representative track list", () => {
    const changed = clone(catalog);
    changed.albums.find((album) => album.slug === "hounds-of-love").tracks = changed.albums.find((album) => album.slug === "hounds-of-love").tracks.slice(0, 3);
    expect(issueFor(changed, "hounds-of-love", "tracks")).toBe(true);
  });

  it("rejects a false first-release year and type", () => {
    const changed = clone(catalog);
    const album = changed.albums.find((item) => item.slug === "whats-going-on");
    album.releaseDate = { value: "1983", precision: "year" };
    album.releaseType = "other";
    expect(issueFor(changed, "whats-going-on", "releaseDate")).toBe(true);
    expect(issueFor(changed, "whats-going-on", "releaseType")).toBe(true);
  });
  it("rejects duplicate fixed IDs and a non-Album primary identity", () => {
    const changed = clone(identities);
    changed.identities[1].verifiedReleaseGroupId = changed.identities[0].verifiedReleaseGroupId;
    changed.identities[2].expectedPrimaryType = "Single";
    const issues = validateCatalog(catalog, changed);
    expect(issues.some((issue) => issue.message.includes("duplicate fixed"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("expectedPrimaryType"))).toBe(true);
  });

  it("rejects a fixed external URL that is not approved for that album", () => {
    const changed = clone(catalog);
    const album = changed.albums.find((item) => item.slug === "hounds-of-love");
    album.externalLinks[0].url = "https://music.apple.com/us/album/not-the-reviewed-record/1";
    expect(issueFor(changed, "hounds-of-love", "externalLinks[0]")).toBe(true);
  });
});
