import type { NormalizedLibraryState, LibraryMembershipReason } from "./collection-presentation";
import { normalizeLibraryState } from "./collection-presentation";
import type { PublishedAlbumSummary, PublishedArtistIndex } from "./schema";

export const ARTIST_COLLECTION_STATES = [
  "SAVED",
  "LIKED",
  "FAVORITE",
  "MARKED_LISTENED",
  "DISMISSED",
  "RECENTLY_VIEWED",
] as const;

export type ArtistCollectionState = (typeof ARTIST_COLLECTION_STATES)[number];
export type ArtistCollectionShape = "EMPTY" | "SPARSE" | "DENSE" | "MIXED";
export type ArtistCatalogShape = "SINGLE_WORK" | "MULTI_WORK";
export type ArtistCollectionPrimaryStatus = ArtistCollectionState | "NONE";

export interface ArtistCollectionAlbumEntry {
  readonly albumId: string;
  readonly slug: string;
  readonly album: PublishedAlbumSummary;
  readonly chronologyPosition: number;
  readonly credit: Readonly<{
    position: number;
    count: number;
    kind: "SOLE_CREDIT" | "SHARED_CREDIT";
  }>;
  readonly membershipReasons: readonly LibraryMembershipReason[];
  readonly states: Readonly<{
    saved: boolean;
    liked: boolean;
    favorite: boolean;
    markedListened: boolean;
    dismissed: boolean;
    recentlyViewed: boolean;
  }>;
  readonly primaryStatus: ArtistCollectionPrimaryStatus;
  readonly kept: boolean;
  readonly recentPosition: number | null;
}

export interface ArtistCollectionProjection {
  readonly artist: Readonly<{
    artistId: string;
    slug: string;
    name: string;
    catalogShape: ArtistCatalogShape;
  }>;
  readonly normalizedState: NormalizedLibraryState;
  readonly publishedAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly keptAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly listenLaterAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly likedAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly favoriteAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly markedListenedAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly dismissedAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly recentlyViewedAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly uncollectedPublishedAlbums: readonly ArtistCollectionAlbumEntry[];
  readonly summary: Readonly<{
    publishedWorksCount: number;
    keptWorksCount: number;
    listenLaterWorksCount: number;
    likedWorksCount: number;
    favoriteWorksCount: number;
    markedListenedWorksCount: number;
    dismissedWorksCount: number;
    recentlyViewedWorksCount: number;
    uncollectedPublishedWorksCount: number;
    collectionShape: ArtistCollectionShape;
  }>;
}

export interface ArtistAlbumGraphAudit {
  readonly artistCount: number;
  readonly albumCount: number;
  readonly singleWorkArtists: number;
  readonly multiWorkArtists: number;
  readonly artistAlbumMemberships: number;
  readonly invalidArtistReferences: number;
  readonly invalidAlbumReferences: number;
  readonly unresolvedAlbumReferences: number;
  readonly duplicateArtistNodes: number;
  readonly duplicateAlbumNodes: number;
  readonly duplicateArtistAlbumMemberships: number;
  readonly creditMismatches: number;
}

interface ArtistCollectionStateIndex {
  readonly saved: ReadonlySet<string>;
  readonly liked: ReadonlySet<string>;
  readonly favorite: ReadonlySet<string>;
  readonly markedListened: ReadonlySet<string>;
  readonly dismissed: ReadonlySet<string>;
  readonly recentPositions: ReadonlyMap<string, number>;
}

function indexState(state: NormalizedLibraryState): ArtistCollectionStateIndex {
  return Object.freeze({
    saved: new Set(state.savedAlbumIds),
    liked: new Set(state.likedAlbumIds),
    favorite: new Set(state.favoriteAlbumIds),
    markedListened: new Set(state.listenedAlbumIds),
    dismissed: new Set(state.dismissedAlbumIds),
    recentPositions: new Map(state.recentAlbumIds.map((id, index) => [id, index] as const)),
  });
}

function chronologyNewest(a: PublishedAlbumSummary, b: PublishedAlbumSummary) {
  return (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")
    || a.title.localeCompare(b.title, "zh-CN")
    || a.id.localeCompare(b.id);
}

function primaryStatus(entry: Omit<ArtistCollectionAlbumEntry, "primaryStatus" | "kept">): ArtistCollectionPrimaryStatus {
  if (entry.states.dismissed) return "DISMISSED";
  if (entry.states.favorite) return "FAVORITE";
  if (entry.states.liked) return "LIKED";
  if (entry.states.saved) return "SAVED";
  if (entry.states.markedListened) return "MARKED_LISTENED";
  if (entry.states.recentlyViewed) return "RECENTLY_VIEWED";
  return "NONE";
}

function collectionShape(entries: readonly ArtistCollectionAlbumEntry[], publishedCount: number): ArtistCollectionShape {
  if (!entries.length) return "EMPTY";
  const primaryPositiveStates = new Set(entries.map((entry) => entry.primaryStatus));
  if (entries.length > 1 && primaryPositiveStates.size > 1) return "MIXED";
  if (entries.length >= Math.max(4, Math.ceil(publishedCount * 0.6))) return "DENSE";
  return "SPARSE";
}

function projectWithNormalizedState({
  artist,
  catalogById,
  normalizedState,
  stateIndex,
}: {
  artist: PublishedArtistIndex;
  catalogById: ReadonlyMap<string, PublishedAlbumSummary>;
  normalizedState: NormalizedLibraryState;
  stateIndex: ArtistCollectionStateIndex;
}): ArtistCollectionProjection {
  const { saved, liked, favorite, markedListened, dismissed, recentPositions } = stateIndex;
  const seen = new Set<string>();
  const albums = artist.albumIds.map((albumId) => {
    if (seen.has(albumId)) throw new Error(`Duplicate Artist→Album membership: ${artist.artistId} → ${albumId}`);
    seen.add(albumId);
    const album = catalogById.get(albumId);
    if (!album) throw new Error(`Unresolved Artist→Album membership: ${artist.artistId} → ${albumId}`);
    const creditPosition = album.artists.findIndex((credit) => credit.id === artist.artistId);
    if (creditPosition < 0) throw new Error(`Artist index membership is not backed by an Album credit: ${artist.artistId} → ${albumId}`);
    return album;
  }).sort(chronologyNewest).map((album, chronologyPosition): ArtistCollectionAlbumEntry => {
    const membershipReasons = [
      saved.has(album.id) ? "SAVED" : null,
      liked.has(album.id) ? "LIKED" : null,
      favorite.has(album.id) ? "FAVORITE" : null,
      markedListened.has(album.id) ? "MARKED_LISTENED" : null,
    ].filter((reason): reason is LibraryMembershipReason => reason !== null);
    const recentPosition = recentPositions.get(album.id) ?? null;
    const partial = Object.freeze({
      albumId: album.id,
      slug: album.slug,
      album,
      chronologyPosition,
      credit: Object.freeze({
        position: album.artists.findIndex((credit) => credit.id === artist.artistId),
        count: album.artists.length,
        kind: album.artists.length > 1 ? "SHARED_CREDIT" as const : "SOLE_CREDIT" as const,
      }),
      membershipReasons: Object.freeze(membershipReasons),
      states: Object.freeze({
        saved: saved.has(album.id),
        liked: liked.has(album.id),
        favorite: favorite.has(album.id),
        markedListened: markedListened.has(album.id),
        dismissed: dismissed.has(album.id),
        recentlyViewed: recentPosition !== null,
      }),
      recentPosition,
    });
    const status = primaryStatus(partial);
    return Object.freeze({
      ...partial,
      primaryStatus: status,
      // A dismissed/not-for-me record is never promoted as positive collection evidence.
      kept: !partial.states.dismissed && membershipReasons.length > 0,
    });
  });
  if (albums.length !== artist.albumCount) throw new Error(`Artist album count mismatch: ${artist.artistId}`);

  const publishedAlbums = Object.freeze(albums);
  const keptAlbums = Object.freeze(albums.filter((entry) => entry.kept));
  const listenLaterAlbums = Object.freeze(albums.filter((entry) => entry.states.saved));
  const likedAlbums = Object.freeze(albums.filter((entry) => entry.states.liked));
  const favoriteAlbums = Object.freeze(albums.filter((entry) => entry.states.favorite));
  const markedListenedAlbums = Object.freeze(albums.filter((entry) => entry.states.markedListened));
  const dismissedAlbums = Object.freeze(albums.filter((entry) => entry.states.dismissed));
  const recentlyViewedAlbums = Object.freeze(albums.filter((entry) => entry.states.recentlyViewed)
    .sort((a, b) => (a.recentPosition ?? Number.MAX_SAFE_INTEGER) - (b.recentPosition ?? Number.MAX_SAFE_INTEGER)));
  const uncollectedPublishedAlbums = Object.freeze(albums.filter((entry) => !entry.kept));

  return Object.freeze({
    artist: Object.freeze({
      artistId: artist.artistId,
      slug: artist.slug,
      name: artist.name,
      catalogShape: artist.albumCount === 1 ? "SINGLE_WORK" : "MULTI_WORK",
    }),
    normalizedState,
    publishedAlbums,
    keptAlbums,
    listenLaterAlbums,
    likedAlbums,
    favoriteAlbums,
    markedListenedAlbums,
    dismissedAlbums,
    recentlyViewedAlbums,
    uncollectedPublishedAlbums,
    summary: Object.freeze({
      publishedWorksCount: albums.length,
      keptWorksCount: keptAlbums.length,
      listenLaterWorksCount: listenLaterAlbums.length,
      likedWorksCount: likedAlbums.length,
      favoriteWorksCount: favoriteAlbums.length,
      markedListenedWorksCount: markedListenedAlbums.length,
      dismissedWorksCount: dismissedAlbums.length,
      recentlyViewedWorksCount: recentlyViewedAlbums.length,
      uncollectedPublishedWorksCount: uncollectedPublishedAlbums.length,
      collectionShape: collectionShape(keptAlbums, albums.length),
    }),
  });
}

export function projectArtistCollection({
  artist,
  catalog,
  state,
}: {
  artist: PublishedArtistIndex;
  catalog: readonly PublishedAlbumSummary[];
  state: unknown;
}) {
  const normalizedState = normalizeLibraryState(state, catalog);
  const catalogById = new Map(catalog.map((album) => [album.id, album] as const));
  return projectWithNormalizedState({ artist, catalogById, normalizedState, stateIndex: indexState(normalizedState) });
}

export function projectAllArtistCollections({
  artists,
  catalog,
  state,
}: {
  artists: readonly PublishedArtistIndex[];
  catalog: readonly PublishedAlbumSummary[];
  state: unknown;
}) {
  const normalizedState = normalizeLibraryState(state, catalog);
  const catalogById = new Map(catalog.map((album) => [album.id, album] as const));
  const stateIndex = indexState(normalizedState);
  return Object.freeze(artists.map((artist) => projectWithNormalizedState({ artist, catalogById, normalizedState, stateIndex })));
}

export function auditArtistAlbumGraph(
  artists: readonly PublishedArtistIndex[],
  catalog: readonly PublishedAlbumSummary[],
): ArtistAlbumGraphAudit {
  const artistIds = new Set<string>();
  const albumIds = new Set<string>();
  let duplicateArtistNodes = 0;
  let duplicateAlbumNodes = 0;
  for (const artist of artists) {
    if (artistIds.has(artist.artistId)) duplicateArtistNodes += 1;
    else artistIds.add(artist.artistId);
  }
  for (const album of catalog) {
    if (albumIds.has(album.id)) duplicateAlbumNodes += 1;
    else albumIds.add(album.id);
  }
  const albumById = new Map(catalog.map((album) => [album.id, album] as const));
  let invalidArtistReferences = 0;
  let invalidAlbumReferences = 0;
  let unresolvedAlbumReferences = 0;
  let duplicateArtistAlbumMemberships = 0;
  let creditMismatches = 0;
  let artistAlbumMemberships = 0;
  for (const artist of artists) {
    const seen = new Set<string>();
    for (const albumId of artist.albumIds) {
      artistAlbumMemberships += 1;
      if (seen.has(albumId)) duplicateArtistAlbumMemberships += 1;
      seen.add(albumId);
      const album = albumById.get(albumId);
      if (!album) invalidAlbumReferences += 1;
      else if (!album.artists.some((credit) => credit.id === artist.artistId)) creditMismatches += 1;
    }
    if (artist.albumCount !== artist.albumIds.length) unresolvedAlbumReferences += Math.abs(artist.albumCount - artist.albumIds.length);
  }
  for (const album of catalog) {
    for (const credit of album.artists) if (!artistIds.has(credit.id)) invalidArtistReferences += 1;
  }
  return Object.freeze({
    artistCount: artists.length,
    albumCount: catalog.length,
    singleWorkArtists: artists.filter((artist) => artist.albumCount === 1).length,
    multiWorkArtists: artists.filter((artist) => artist.albumCount > 1).length,
    artistAlbumMemberships,
    invalidArtistReferences,
    invalidAlbumReferences,
    unresolvedAlbumReferences,
    duplicateArtistNodes,
    duplicateAlbumNodes,
    duplicateArtistAlbumMemberships,
    creditMismatches,
  });
}
