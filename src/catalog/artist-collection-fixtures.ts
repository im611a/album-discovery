import { createInitialUserState } from "@/features/personal-state/schema";

import { projectArtistCollection } from "./artist-collection";
import { buildArtistCollectionPresentationModel } from "./artist-collection-presentation-model";
import type { PublishedAlbumSummary, PublishedArtistIndex } from "./schema";

export const ARTIST_COLLECTION_FIXTURE_NAMES = Object.freeze([
  "single-work-no-state",
  "single-work-kept",
  "single-work-recent",
  "multi-work-no-state",
  "multi-work-one-kept",
  "multi-work-mixed",
  "multi-work-many-kept",
  "multi-work-all-kept",
  "multi-work-negative",
  "multi-work-recent-only",
  "multi-work-long-title",
  "multi-work-multi-credit",
] as const);

export function buildArtistCollectionFixtures(
  artists: readonly PublishedArtistIndex[],
  catalog: readonly PublishedAlbumSummary[],
) {
  const singles = artists.filter((artist) => artist.albumCount === 1);
  const multis = artists.filter((artist) => artist.albumCount > 1).sort((a, b) => b.albumCount - a.albumCount);
  const single = singles[0]!;
  const dense = multis[0]!;
  const longAlbum = [...catalog].sort((a, b) => b.title.length - a.title.length)[0]!;
  const longArtist = artists.find((artist) => artist.albumIds.includes(longAlbum.id)) ?? dense;
  const sharedAlbum = catalog.find((album) => album.artists.length > 1)!;
  const sharedArtist = artists.find((artist) => artist.artistId === sharedAlbum.artists[0]!.id)!;
  const state = (overrides: Record<string, unknown> = {}) => ({ ...createInitialUserState(), ...overrides });
  const definitions = [
    ["single-work-no-state", single, state()],
    ["single-work-kept", single, state({ favoriteAlbumIds: single.albumIds })],
    ["single-work-recent", single, state({ recentAlbumIds: single.albumIds })],
    ["multi-work-no-state", dense, state()],
    ["multi-work-one-kept", dense, state({ savedAlbumIds: dense.albumIds.slice(0, 1) })],
    ["multi-work-mixed", dense, state({ savedAlbumIds: dense.albumIds.slice(0, 2), favoriteAlbumIds: dense.albumIds.slice(2, 4), listenedAlbumIds: dense.albumIds.slice(4, 5) })],
    ["multi-work-many-kept", dense, state({ favoriteAlbumIds: dense.albumIds.slice(0, Math.max(4, Math.ceil(dense.albumCount * 0.6))) })],
    ["multi-work-all-kept", dense, state({ savedAlbumIds: dense.albumIds })],
    ["multi-work-negative", dense, state({ savedAlbumIds: dense.albumIds.slice(0, 2), listenedAlbumIds: dense.albumIds.slice(0, 2), dismissedAlbumIds: dense.albumIds.slice(0, 2) })],
    ["multi-work-recent-only", dense, state({ recentAlbumIds: dense.albumIds.slice(0, 10) })],
    ["multi-work-long-title", longArtist, state({ savedAlbumIds: [longAlbum.id] })],
    ["multi-work-multi-credit", sharedArtist, state({ favoriteAlbumIds: [sharedAlbum.id] })],
  ] as const;
  return Object.freeze(definitions.map(([name, artist, localState]) => {
    const projection = projectArtistCollection({ artist, catalog, state: localState });
    return Object.freeze({
      name,
      artist,
      state: localState,
      projection,
      presentation: buildArtistCollectionPresentationModel({ projection, catalog }),
    });
  }));
}
