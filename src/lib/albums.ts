import type { MockAlbum } from "@/data/albums.mock";

export function byNewestRelease(albums: MockAlbum[]) {
  return [...albums].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}

export function byHighestRating(albums: MockAlbum[]) {
  return albums
    .filter(
      (album): album is MockAlbum & { rymScore: number; rymRatingCount: number } =>
        album.rymScore !== null && album.rymRatingCount !== null,
    )
    .sort(
      (a, b) =>
        b.rymScore - a.rymScore || b.rymRatingCount - a.rymRatingCount,
    );
}

export function byRecentlyAdded(albums: MockAlbum[]) {
  return [...albums].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function formatArtists(artists: string[]) {
  return artists.join("、");
}
