import { catalogAlbums, catalogTaxonomy, publishedArtists } from "./published-catalog";
import type { PublishedAlbumSummary, ReleaseType, SourceMarketChannel } from "./schema";

export type CatalogSort = "recently-added" | "release-newest" | "release-oldest" | "title" | "rym-rating-desc";
export interface DiscoverFilters {
  coreGenre?: string | null;
  relatedGenre?: string | null;
  context?: string | null;
  decade?: string | null;
  releaseType?: ReleaseType | null;
  editorialOnly?: boolean;
}

export const getAllAlbums = () => catalogAlbums;
export const getAlbumBySlug = (slug: string) => catalogAlbums.find((album) => album.slug === slug) ?? null;
export const getEditorialPicks = (limit = 6) => catalogAlbums.filter((album) => album.editorial).slice(0, limit);
export const getRecentlyAdded = (limit?: number) => [...catalogAlbums]
  .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt) || a.title.localeCompare(b.title, "zh-CN"))
  .slice(0, limit);
export const getRecentReleases = (fromYear: number) => catalogAlbums
  .filter((album) => Number(album.releaseDate?.slice(0, 4)) >= fromYear)
  .sort(compareReleaseNewest);
export const getMarketChannelAlbums = (channel: SourceMarketChannel) => catalogAlbums
  .filter((album) => channel === "ALL" ? album.sourceMarketChannels.length > 0 : album.sourceMarketChannels.includes(channel))
  .sort(compareReleaseNewest);

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\p{P}\p{S}\s]+/gu, " ").trim().toLocaleLowerCase("zh-CN");
}

export function searchArtists(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const terms = normalized.split(" ");
  return publishedArtists.filter((artist) => {
    const haystack = normalizeSearchText([artist.name, ...artist.aliases].join(" "));
    return terms.every((term) => haystack.includes(term));
  }).sort((a, b) =>
    Number(normalizeSearchText(b.name) === normalized) - Number(normalizeSearchText(a.name) === normalized) ||
    b.albumCount - a.albumCount ||
    a.name.localeCompare(b.name, "zh-CN"),
  );
}

export function searchAlbums(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const terms = normalized.split(" ");
  return catalogAlbums.filter((album) => {
    const haystack = normalizeSearchText(album.searchText);
    return terms.every((term) => haystack.includes(term));
  }).sort((a, b) => {
    const aTitle = normalizeSearchText(a.title);
    const bTitle = normalizeSearchText(b.title);
    return Number(bTitle === normalized) - Number(aTitle === normalized) ||
      Number(bTitle.startsWith(normalized)) - Number(aTitle.startsWith(normalized)) ||
      compareReleaseNewest(a, b);
  });
}

function releaseValue(album: PublishedAlbumSummary) {
  return album.releaseDate ?? "0000";
}

function compareReleaseNewest(a: PublishedAlbumSummary, b: PublishedAlbumSummary) {
  return releaseValue(b).localeCompare(releaseValue(a)) || a.title.localeCompare(b.title, "zh-CN");
}

export function discoverAlbums(
  filters: DiscoverFilters = {},
  sort: CatalogSort = "recently-added",
  albums: PublishedAlbumSummary[] = catalogAlbums,
) {
  const filtered = albums.filter((album) =>
    (!filters.coreGenre || album.coreGenres.includes(filters.coreGenre)) &&
    (!filters.relatedGenre || album.relatedGenres.includes(filters.relatedGenre)) &&
    (!filters.context || album.contexts.includes(filters.context)) &&
    (!filters.decade || album.releaseDate?.startsWith(filters.decade.slice(0, 3))) &&
    (!filters.releaseType || album.albumType === filters.releaseType) &&
    (!filters.editorialOnly || Boolean(album.editorial)),
  );
  return [...filtered].sort((a, b) => {
    if (sort === "release-newest") return compareReleaseNewest(a, b);
    if (sort === "release-oldest") return -compareReleaseNewest(a, b);
    if (sort === "title") return a.title.localeCompare(b.title, "zh-CN");
    if (sort === "rym-rating-desc") {
      const ratingPresence = Number(b.rymRating != null) - Number(a.rymRating != null);
      if (ratingPresence) return ratingPresence;
      if (a.rymRating != null && b.rymRating != null) {
        const rating = b.rymRating - a.rymRating;
        if (rating) return rating;
        if (a.rymRatingCount != null && b.rymRatingCount != null && a.rymRatingCount !== b.rymRatingCount) {
          return b.rymRatingCount - a.rymRatingCount;
        }
      }
      return b.discoveredAt.localeCompare(a.discoveredAt) ||
        a.title.localeCompare(b.title, "zh-CN") ||
        a.internalId.localeCompare(b.internalId);
    }
    return b.discoveredAt.localeCompare(a.discoveredAt) || a.title.localeCompare(b.title, "zh-CN");
  });
}

export function getRelatedAlbums(album: PublishedAlbumSummary, limit = 6) {
  return catalogAlbums
    .filter((item) => item.id !== album.id)
    .map((item) => ({
      item,
      score:
        item.coreGenres.filter((value) => album.coreGenres.includes(value)).length * 5 +
        item.relatedGenres.filter((value) => album.relatedGenres.includes(value)).length * 3 +
        item.contexts.filter((value) => album.contexts.includes(value)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function buildDiscoverOptions(albums: PublishedAlbumSummary[] = catalogAlbums) {
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return {
    coreGenres: catalogTaxonomy.filter((item) => item.kind === "core" && albums.some((album) => album.coreGenres.includes(item.key))).map((item) => item.key),
    relatedGenres: unique(albums.flatMap((album) => album.relatedGenres)),
    contexts: unique(albums.flatMap((album) => album.contexts)),
    decades: unique(albums.map((album) => album.releaseDate ? `${Math.floor(Number(album.releaseDate.slice(0, 4)) / 10) * 10}s` : "").filter(Boolean)),
  };
}

export const getAlbumsForArtist = (artistId: string) =>
  catalogAlbums.filter((album) => album.artists.some((artist) => artist.id === artistId))
    .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.title.localeCompare(b.title, "zh-CN"));
