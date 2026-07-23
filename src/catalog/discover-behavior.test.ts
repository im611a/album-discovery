import { describe, expect, it } from "vitest";
import { buildDiscoverOptions, discoverAlbums } from "./queries";

describe("discover combinations and sorting", () => {
  it("publishes stable options backed by non-empty results", () => {
    const options = buildDiscoverOptions();
    for (const genre of options.coreGenres) expect(discoverAlbums({ coreGenre: genre }).length).toBeGreaterThan(0);
  });
  it("combines the currently available genre, context, decade, release type and guide filters", () => {
    const album = discoverAlbums({ editorialOnly: true })[0]!;
    const decade = `${Math.floor(Number(album.releaseDate!.slice(0, 4)) / 10) * 10}s`;
    const results = discoverAlbums({ coreGenre: album.coreGenres[0], context: album.contexts[0], decade, releaseType: album.albumType, editorialOnly: true });
    expect(results.map((item) => item.id)).toContain(album.id);
    expect(buildDiscoverOptions().relatedGenres).toEqual([]);
    expect(buildDiscoverOptions().descriptors).toEqual([]);
  });
  it.each(["release-newest", "release-oldest", "title", "recently-added"] as const)("returns a deterministic %s order", (sort) => expect(discoverAlbums({}, sort).map((album) => album.id)).toEqual(discoverAlbums({}, sort).map((album) => album.id)));
  it("sorts newest and oldest in opposite date directions", () => {
    const newest = discoverAlbums({}, "release-newest").map((album) => album.releaseDate ?? "0000");
    const oldest = discoverAlbums({}, "release-oldest").map((album) => album.releaseDate ?? "0000");
    expect(newest[0]! >= newest.at(-1)!).toBe(true);
    expect(oldest[0]! <= oldest.at(-1)!).toBe(true);
  });
});
