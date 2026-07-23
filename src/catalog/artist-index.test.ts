import { describe, expect, it } from "vitest";
import { getAlbumsForArtist, searchArtists } from "./queries";
import { catalogAlbums, getArtistBySlug, publishedArtists } from "./published-catalog";

describe("published artist index", () => {
  it("publishes one stable entry for every unique catalog artist", () => {
    const ids = new Set(catalogAlbums.flatMap((album) => album.artists.map((artist) => artist.id)));
    expect(publishedArtists).toHaveLength(ids.size);
    expect(new Set(publishedArtists.map((artist) => artist.artistId)).size).toBe(publishedArtists.length);
    expect(new Set(publishedArtists.map((artist) => artist.slug)).size).toBe(publishedArtists.length);
  });

  it("keeps album counts and type counts derived from the lightweight index", () => {
    for (const artist of publishedArtists) {
      const albums = getAlbumsForArtist(artist.artistId);
      expect(albums).toHaveLength(artist.albumCount);
      expect(Object.values(artist.albumCountByType).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(artist.albumCount);
    }
  });

  it("associates a collaboration album with every credited artist", () => {
    const collaboration = catalogAlbums.find((album) => album.artists.length > 1);
    expect(collaboration).toBeDefined();
    for (const artist of collaboration!.artists) {
      expect(getAlbumsForArtist(artist.id).map((album) => album.id)).toContain(collaboration!.id);
    }
  });

  it("searches artist names without case sensitivity and resolves slugs", () => {
    const radiohead = searchArtists("RADIOHEAD")[0];
    expect(radiohead?.name.toLocaleLowerCase("en-US")).toContain("radiohead");
    expect(getArtistBySlug(radiohead!.slug)?.artistId).toBe(radiohead!.artistId);
  });
});
