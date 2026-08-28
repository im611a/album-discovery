import { describe, expect, it } from "vitest";
import { publishedArtists } from "./published-catalog";
import { ARTIST_GENRE_GROUPS, countArtistGenreGroups, getArtistGenreGroup, getArtistPrimaryGenre } from "./artist-primary-genre";

describe("artist primary genre groups", () => {
  it("uses the first publisher-ranked genre as deterministic primary evidence", () => {
    const artist = publishedArtists.find((candidate) => candidate.commonCoreGenres.length > 1)!;
    expect(getArtistPrimaryGenre(artist)).toBe(artist.commonCoreGenres[0]);
  });

  it("folds real catalog subgenres into compact musical groups", () => {
    expect(getArtistGenreGroup({ commonCoreGenres: ["art-pop"] })).toBe("pop");
    expect(getArtistGenreGroup({ commonCoreGenres: ["post-rock"] })).toBe("rock");
    expect(getArtistGenreGroup({ commonCoreGenres: [] })).toBe("other");
  });

  it("assigns every published artist to exactly one group without geography", () => {
    const counts = countArtistGenreGroups(publishedArtists);
    const grouped = ARTIST_GENRE_GROUPS.filter((group) => group.key !== "all").reduce((total, group) => total + counts[group.key], 0);
    expect(grouped).toBe(publishedArtists.length);
    expect(counts.all).toBe(453);
    expect(counts.pop).toBeGreaterThan(0);
    expect(counts["hip-hop"]).toBeGreaterThan(0);
    expect(Object.keys(counts)).not.toContain("region");
  });
});
