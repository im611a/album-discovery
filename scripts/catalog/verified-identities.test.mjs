import { describe, expect, it } from "vitest";
import catalog from "../../src/data/generated/catalog.json" with { type: "json" };
import identities from "./verified-identities.json" with { type: "json" };
import { normalizeIdentity } from "./lib/catalog-utils.mjs";

const albums = new Map(catalog.albums.map((album) => [album.slug, album]));

describe("120 fixed MusicBrainz identities", () => {
  it("contains one reviewed identity for every published album", () => {
    expect(identities.identities).toHaveLength(120);
    expect(new Set(identities.identities.map((item) => item.verifiedReleaseGroupId)).size).toBe(120);
  });

  it.each(identities.identities)("keeps $key bound to its reviewed release group", (identity) => {
    const album = albums.get(identity.key);
    expect(album?.musicbrainzReleaseGroupId).toBe(identity.verifiedReleaseGroupId);
    expect([identity.expectedTitle, ...identity.acceptedTitleVariants].map(normalizeIdentity)).toContain(normalizeIdentity(album?.title));
    expect(album?.releaseDate?.value.slice(0, 4)).toBe(identity.expectedFirstReleaseYear);
    expect(album?.releaseType).toBe(identity.expectedReleaseType);
    expect(identity.verificationNote).toMatch(/Official MusicBrainz/);
  });
});
