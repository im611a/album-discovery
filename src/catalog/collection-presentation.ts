import { MAX_LOCAL_RECENT_ALBUMS } from "@/features/personal-state/schema";

import { normalizeSearchText } from "./queries";
import type { PublishedAlbumSummary } from "./schema";

export const LIBRARY_VIEWS = [
  "overview",
  "all",
  "saved",
  "liked",
  "favorite",
  "listened",
  "dismissed",
  "recent",
] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export const LIBRARY_FACETS = [
  "all",
  "saved",
  "liked",
  "favorite",
  "listened",
  "dismissed",
  "recent",
] as const;
export type LibraryFacet = (typeof LIBRARY_FACETS)[number];

export const LIBRARY_SORTS = ["catalog", "title", "release-newest"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const MAX_LIBRARY_QUERY_LENGTH = 100;
const MAX_LIBRARY_CONTEXT_LENGTH = 64;

export interface NormalizedLibraryState {
  readonly savedAlbumIds: readonly string[];
  readonly likedAlbumIds: readonly string[];
  readonly favoriteAlbumIds: readonly string[];
  readonly listenedAlbumIds: readonly string[];
  readonly dismissedAlbumIds: readonly string[];
  readonly recentAlbumIds: readonly string[];
}

export type LibraryMembershipReason = "SAVED" | "LIKED" | "FAVORITE" | "MARKED_LISTENED";

export interface LibraryAlbumEntry {
  readonly albumId: string;
  readonly slug: string;
  readonly album: PublishedAlbumSummary;
  readonly membershipReasons: readonly LibraryMembershipReason[];
  readonly states: Readonly<{
    saved: boolean;
    liked: boolean;
    favorite: boolean;
    markedListened: boolean;
    dismissed: boolean;
  }>;
  readonly recentlyViewed: boolean;
  readonly recentPosition: number | null;
  readonly catalogPosition: number;
  readonly lastChangedAt: null;
}

export interface LibraryFacetSummary {
  readonly facet: LibraryFacet;
  readonly label: string;
  readonly semanticNote: string;
  readonly count: number;
}

export interface LibrarySummary {
  readonly totalLibraryAlbums: number;
  readonly savedCount: number;
  readonly likedCount: number;
  readonly favoriteCount: number;
  readonly markedListenedCount: number;
  readonly dismissedCount: number;
  readonly recentlyViewedCount: number;
}

export interface LibraryQuery {
  readonly view: LibraryView;
  readonly query: string;
  readonly sort: LibrarySort;
}

export interface LibraryProjection {
  readonly query: LibraryQuery;
  readonly normalizedState: NormalizedLibraryState;
  readonly entries: readonly LibraryAlbumEntry[];
  readonly recentEntries: readonly LibraryAlbumEntry[];
  readonly facets: readonly LibraryFacetSummary[];
  readonly summary: LibrarySummary;
  readonly emptyReason: "FRESH" | "VIEW_EMPTY" | "NO_QUERY_MATCH" | null;
}

export interface LibraryReturnContext {
  readonly source: "library" | null;
  readonly view: LibraryView | null;
  readonly query: string;
  readonly sort: LibrarySort | null;
}

const FACET_COPY: Readonly<Record<LibraryFacet, readonly [string, string]>> = Object.freeze({
  all: ["全部保留", "想听、喜欢、收藏或标记听过的专辑，按专辑去重。"] as const,
  saved: ["想听", "你明确保存到想听清单的专辑。"] as const,
  liked: ["喜欢", "你明确标记喜欢的专辑。"] as const,
  favorite: ["收藏", "你明确收藏在当前设备上的专辑。"] as const,
  listened: ["标记听过", "你明确标记为听过；这不是播放记录。"] as const,
  dismissed: ["不适合我", "你明确标记为不适合的专辑。"] as const,
  recent: ["最近查看", "你最近打开过的专辑页面；浏览不等于收听。"] as const,
});

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValues(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function canonicalIds(values: readonly string[], validIds: ReadonlySet<string>, limit: number) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const id of values) {
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    output.push(id);
    if (output.length === limit) break;
  }
  return Object.freeze(output);
}

/**
 * A tolerant, projection-only normalizer. It never writes or migrates persistent state;
 * the existing LocalUserStateV1 parser remains the storage authority.
 */
export function normalizeLibraryState(value: unknown, catalog: readonly PublishedAlbumSummary[]): NormalizedLibraryState {
  const input = objectValue(value);
  const validIds = new Set(catalog.map((album) => album.id));
  const feedback = objectValue(input.recommendationFeedback);
  const feedbackLiked = Object.entries(feedback)
    .filter(([, state]) => state === "like")
    .map(([id]) => id);
  const feedbackDismissed = Object.entries(feedback)
    .filter(([, state]) => state === "not_for_me")
    .map(([id]) => id);
  const dismissed = canonicalIds(
    [...stringValues(input.dismissedAlbumIds), ...feedbackDismissed],
    validIds,
    validIds.size,
  );
  const dismissedSet = new Set(dismissed);
  const withoutDismissed = (values: readonly string[]) => Object.freeze(
    canonicalIds(values, validIds, validIds.size).filter((id) => !dismissedSet.has(id)),
  );
  const favoriteIds = stringValues(input.favoriteAlbumIds);
  const explicitLiked = Array.isArray(input.likedAlbumIds)
    ? stringValues(input.likedAlbumIds)
    : favoriteIds;

  return Object.freeze({
    savedAlbumIds: withoutDismissed(stringValues(input.savedAlbumIds)),
    likedAlbumIds: withoutDismissed([...explicitLiked, ...feedbackLiked]),
    favoriteAlbumIds: withoutDismissed(favoriteIds),
    // A past explicit marker remains a fact even when the album is later dismissed.
    listenedAlbumIds: canonicalIds(stringValues(input.listenedAlbumIds), validIds, validIds.size),
    dismissedAlbumIds: dismissed,
    recentAlbumIds: canonicalIds(
      stringValues(input.recentAlbumIds),
      validIds,
      Math.min(MAX_LOCAL_RECENT_ALBUMS, validIds.size),
    ),
  });
}

function accepted<T extends string>(value: string | null, values: readonly T[], fallback: T) {
  return value && values.includes(value as T) ? value as T : fallback;
}

function boundedQuery(value: string | null) {
  return Array.from(value?.trim() ?? "").slice(0, MAX_LIBRARY_QUERY_LENGTH).join("");
}

export function parseLibraryQuery(input: string | URLSearchParams): LibraryQuery {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  return Object.freeze({
    view: accepted(params.get("view"), LIBRARY_VIEWS, "overview"),
    query: boundedQuery(params.get("q")),
    sort: accepted(params.get("sort"), LIBRARY_SORTS, "catalog"),
  });
}

export function serializeLibraryQuery(query: LibraryQuery) {
  const params = new URLSearchParams();
  if (query.view !== "overview") params.set("view", query.view);
  if (query.query) params.set("q", boundedQuery(query.query));
  if (query.sort !== "catalog") params.set("sort", query.sort);
  return params.toString();
}

function compareTitle(left: LibraryAlbumEntry, right: LibraryAlbumEntry) {
  return left.album.title.localeCompare(right.album.title, "zh-CN") || left.albumId.localeCompare(right.albumId);
}

function compareReleaseNewest(left: LibraryAlbumEntry, right: LibraryAlbumEntry) {
  return (right.album.releaseDate ?? "0000").localeCompare(left.album.releaseDate ?? "0000") ||
    compareTitle(left, right);
}

function sortEntries(entries: readonly LibraryAlbumEntry[], sort: LibrarySort, preserveRecent: boolean) {
  if (sort === "title") return [...entries].sort(compareTitle);
  if (sort === "release-newest") return [...entries].sort(compareReleaseNewest);
  return preserveRecent
    ? [...entries].sort((left, right) => (left.recentPosition ?? Number.MAX_SAFE_INTEGER) - (right.recentPosition ?? Number.MAX_SAFE_INTEGER))
    : [...entries].sort((left, right) => left.catalogPosition - right.catalogPosition);
}

function queryEntries(entries: readonly LibraryAlbumEntry[], query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [...entries];
  const terms = normalized.split(" ");
  return entries.filter((entry) => {
    const haystack = normalizeSearchText(entry.album.searchText);
    return terms.every((term) => haystack.includes(term));
  });
}

export function buildLibraryProjection({
  catalog,
  state,
  query: queryInput = "",
}: {
  catalog: readonly PublishedAlbumSummary[];
  state: unknown;
  query?: string | URLSearchParams | LibraryQuery;
}): LibraryProjection {
  const query = typeof queryInput === "string" || queryInput instanceof URLSearchParams
    ? parseLibraryQuery(queryInput)
    : Object.freeze({
      view: accepted(queryInput.view, LIBRARY_VIEWS, "overview"),
      query: boundedQuery(queryInput.query),
      sort: accepted(queryInput.sort, LIBRARY_SORTS, "catalog"),
    });
  const uniqueCatalog: PublishedAlbumSummary[] = [];
  const seenCatalogIds = new Set<string>();
  for (const album of catalog) {
    if (!album.id || seenCatalogIds.has(album.id)) continue;
    seenCatalogIds.add(album.id);
    uniqueCatalog.push(album);
  }
  const normalizedState = normalizeLibraryState(state, uniqueCatalog);
  const saved = new Set(normalizedState.savedAlbumIds);
  const liked = new Set(normalizedState.likedAlbumIds);
  const favorite = new Set(normalizedState.favoriteAlbumIds);
  const listened = new Set(normalizedState.listenedAlbumIds);
  const dismissed = new Set(normalizedState.dismissedAlbumIds);
  const recentPositions = new Map(normalizedState.recentAlbumIds.map((id, index) => [id, index] as const));
  const allEntries = uniqueCatalog.map((album, catalogPosition): LibraryAlbumEntry => {
    const membershipReasons = [
      saved.has(album.id) ? "SAVED" : null,
      liked.has(album.id) ? "LIKED" : null,
      favorite.has(album.id) ? "FAVORITE" : null,
      listened.has(album.id) ? "MARKED_LISTENED" : null,
    ].filter((reason): reason is LibraryMembershipReason => reason !== null);
    const recentPosition = recentPositions.get(album.id) ?? null;
    return Object.freeze({
      albumId: album.id,
      slug: album.slug,
      album,
      membershipReasons: Object.freeze(membershipReasons),
      states: Object.freeze({
        saved: saved.has(album.id),
        liked: liked.has(album.id),
        favorite: favorite.has(album.id),
        markedListened: listened.has(album.id),
        dismissed: dismissed.has(album.id),
      }),
      recentlyViewed: recentPosition !== null,
      recentPosition,
      catalogPosition,
      // LocalUserStateV1 has no per-album timestamp.
      lastChangedAt: null,
    });
  });
  const facetEntries: Readonly<Record<LibraryFacet, readonly LibraryAlbumEntry[]>> = Object.freeze({
    all: Object.freeze(allEntries.filter((entry) => entry.membershipReasons.length > 0)),
    saved: Object.freeze(allEntries.filter((entry) => entry.states.saved)),
    liked: Object.freeze(allEntries.filter((entry) => entry.states.liked)),
    favorite: Object.freeze(allEntries.filter((entry) => entry.states.favorite)),
    listened: Object.freeze(allEntries.filter((entry) => entry.states.markedListened)),
    dismissed: Object.freeze(allEntries.filter((entry) => entry.states.dismissed)),
    recent: Object.freeze(allEntries.filter((entry) => entry.recentlyViewed)),
  });
  const activeFacet: LibraryFacet = query.view === "overview" ? "all" : query.view;
  const selected = facetEntries[activeFacet];
  const filtered = queryEntries(selected, query.query);
  const entries = Object.freeze(sortEntries(filtered, query.sort, activeFacet === "recent"));
  const recentEntries = Object.freeze(sortEntries(facetEntries.recent, "catalog", true));
  const facets = Object.freeze(LIBRARY_FACETS.map((facet): LibraryFacetSummary => Object.freeze({
    facet,
    label: FACET_COPY[facet][0],
    semanticNote: FACET_COPY[facet][1],
    count: facetEntries[facet].length,
  })));
  const summary = Object.freeze({
    totalLibraryAlbums: facetEntries.all.length,
    savedCount: facetEntries.saved.length,
    likedCount: facetEntries.liked.length,
    favoriteCount: facetEntries.favorite.length,
    markedListenedCount: facetEntries.listened.length,
    dismissedCount: facetEntries.dismissed.length,
    recentlyViewedCount: facetEntries.recent.length,
  });
  const emptyReason = summary.totalLibraryAlbums === 0 && summary.recentlyViewedCount === 0 && summary.dismissedCount === 0
    ? "FRESH"
    : query.query && selected.length > 0 && entries.length === 0
      ? "NO_QUERY_MATCH"
      : entries.length === 0
        ? "VIEW_EMPTY"
        : null;

  return Object.freeze({ query, normalizedState, entries, recentEntries, facets, summary, emptyReason });
}

export function parseLibraryReturnContext(input: string | URLSearchParams): LibraryReturnContext {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const rawSource = params.get("lfrom");
  const rawView = params.get("lview");
  if (rawSource !== "library" || rawSource.length > MAX_LIBRARY_CONTEXT_LENGTH) {
    return Object.freeze({ source: null, view: null, query: "", sort: null });
  }
  return Object.freeze({
    source: "library",
    view: rawView && rawView.length <= MAX_LIBRARY_CONTEXT_LENGTH && LIBRARY_VIEWS.includes(rawView as LibraryView)
      ? rawView as LibraryView
      : null,
    query: boundedQuery(params.get("lq")),
    sort: accepted(params.get("lsort"), LIBRARY_SORTS, "catalog"),
  });
}

export function buildLibraryAlbumHref({
  targetSlug,
  view,
  query = "",
  sort = "catalog",
  catalog,
}: {
  targetSlug: string;
  view: LibraryView;
  query?: string;
  sort?: LibrarySort;
  catalog: readonly PublishedAlbumSummary[];
}) {
  if (!catalog.some((album) => album.slug === targetSlug)) return null;
  const params = new URLSearchParams({ lfrom: "library" });
  if (view !== "overview") params.set("lview", view);
  const bounded = boundedQuery(query);
  if (bounded) params.set("lq", bounded);
  if (sort !== "catalog" && LIBRARY_SORTS.includes(sort)) params.set("lsort", sort);
  return `/albums/${targetSlug}?${params}`;
}
