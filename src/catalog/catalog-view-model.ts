import type { LocalUserStateV1 } from "@/features/personal-state/schema";
import { buildDiscoverOptions, discoverAlbums, searchAlbumCollection, type CatalogSort, type DiscoverFilters } from "./queries";
import { RELEASE_TYPE_LABELS, type PublishedAlbumSummary, type ReleaseType } from "./schema";

export type CatalogUserStatus = "liked" | "favorite" | "saved" | "listened" | "dismissed";

export interface CatalogQueryState {
  query: string;
  filters: DiscoverFilters;
  userStatus: CatalogUserStatus | null;
  sort: CatalogSort;
}

export interface CatalogViewModel {
  query: CatalogQueryState;
  albums: PublishedAlbumSummary[];
  resultCount: number;
  empty: boolean;
  emptyMessage: string | null;
  serializedQuery: string;
}

const SORT_VALUES: readonly CatalogSort[] = [
  "recently-added",
  "release-newest",
  "release-oldest",
  "title",
  "rym-rating-desc",
];
const STATUS_VALUES: readonly CatalogUserStatus[] = ["liked", "favorite", "saved", "listened", "dismissed"];
const RELEASE_TYPES = Object.keys(RELEASE_TYPE_LABELS) as ReleaseType[];
const STATUS_KEYS: Record<CatalogUserStatus, keyof LocalUserStateV1> = {
  liked: "likedAlbumIds",
  favorite: "favoriteAlbumIds",
  saved: "savedAlbumIds",
  listened: "listenedAlbumIds",
  dismissed: "dismissedAlbumIds",
};

function accepted<T extends string>(value: string | null, values: readonly T[]): T | null {
  return value && values.includes(value as T) ? value as T : null;
}

export function parseCatalogQuery(
  input: string | URLSearchParams,
  albums: PublishedAlbumSummary[],
): CatalogQueryState {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const options = buildDiscoverOptions(albums);
  return {
    query: params.get("q")?.trim() ?? "",
    filters: {
      coreGenre: accepted(params.get("core"), options.coreGenres),
      relatedGenre: accepted(params.get("related"), options.relatedGenres),
      context: accepted(params.get("scene"), options.contexts),
      decade: accepted(params.get("decade"), options.decades),
      releaseType: accepted(params.get("type"), RELEASE_TYPES),
      editorialOnly: params.get("editorial") === "1",
    },
    userStatus: accepted(params.get("status"), STATUS_VALUES),
    sort: accepted(params.get("sort"), SORT_VALUES) ?? "recently-added",
  };
}

export function serializeCatalogQuery(state: CatalogQueryState) {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.filters.coreGenre) params.set("core", state.filters.coreGenre);
  if (state.filters.relatedGenre) params.set("related", state.filters.relatedGenre);
  if (state.filters.context) params.set("scene", state.filters.context);
  if (state.filters.decade) params.set("decade", state.filters.decade);
  if (state.filters.releaseType) params.set("type", state.filters.releaseType);
  if (state.filters.editorialOnly) params.set("editorial", "1");
  if (state.userStatus) params.set("status", state.userStatus);
  if (state.sort !== "recently-added") params.set("sort", state.sort);
  return params.toString();
}

export function buildCatalogViewModel({
  albums,
  query,
  userState,
}: {
  albums: PublishedAlbumSummary[];
  query: CatalogQueryState;
  userState?: LocalUserStateV1 | null;
}): CatalogViewModel {
  const searched = query.query ? searchAlbumCollection(query.query, albums) : albums;
  let results = discoverAlbums(query.filters, query.sort, searched);
  if (query.userStatus) {
    const ids = new Set<string>(
      userState ? (userState[STATUS_KEYS[query.userStatus]] as string[]) : [],
    );
    results = results.filter((album) => ids.has(album.id));
  }
  return {
    query,
    albums: results,
    resultCount: results.length,
    empty: results.length === 0,
    emptyMessage: results.length === 0 ? "当前条件下没有专辑，试试减少筛选条件。" : null,
    serializedQuery: serializeCatalogQuery(query),
  };
}
