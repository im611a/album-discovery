export type ReleaseDatePrecision = "year" | "month" | "day";
export type ReleaseType = "album" | "ep" | "mixtape" | "soundtrack";
export type SourceMarketChannel = "ALL" | "ZH" | "EA" | "JP" | "KR";
export type RymMatchStatus =
  | "MATCHED"
  | "MATCHED_EXACT"
  | "MATCHED_ALIAS"
  | "MATCHED_STRONG"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "REJECTED"
  | "UNVERIFIED_NO_DATA";

export interface PublishedArtist {
  id: string;
  neteaseArtistId: string;
  name: string;
}

export interface PublishedTrack {
  id: string;
  neteaseTrackId: string | null;
  title: string;
  trackNumber: number;
  discNumber: number;
  artists: string[];
  durationMs: number | null;
}

export interface PublishedCover {
  kind: "local" | "fallback";
  src: string | null;
  thumbnailSrc: string | null;
  alt: string;
  reason: string | null;
}

export interface AlbumEditorial {
  summaryZh: string;
  whyListenZh: string;
  bestFor: string[];
  startWithTrackId: string | null;
  confidence: "curated" | "metadata_based";
  humanReviewed: boolean;
}

export interface PublishedAlbum {
  internalId: string;
  id: string;
  neteaseAlbumId: string;
  slug: string;
  title: string;
  aliases: string[];
  artists: PublishedArtist[];
  releaseDate: string | null;
  releaseDatePrecision: ReleaseDatePrecision | null;
  albumType: ReleaseType;
  company: string | null;
  cover: PublishedCover;
  tracks: PublishedTrack[];
  trackCount: number;
  externalUrl: string;
  discoveredAt: string;
  updatedAt: string;
  sourceMarketChannels: SourceMarketChannel[];
  coreGenres: string[];
  relatedGenres: string[];
  /** Retained only for snapshot compatibility. Never expose this field in product UI. */
  descriptors: string[];
  contexts: string[];
  rymRating: number | null;
  rymRatingCount: number | null;
  rymReference: string | null;
  rymObservedAt: string | null;
  rymInputSourceId: string | null;
  rymMatchStatus: RymMatchStatus;
  editorial: AlbumEditorial | null;
  searchText: string;
  source: {
    catalog: "netease";
    fetchedAt: string;
    parserVersion: string;
    verificationMethod: string;
    error: null;
  };
}

export interface PublishedAlbumSummary {
  internalId: string;
  id: string;
  neteaseAlbumId: string;
  slug: string;
  title: string;
  aliases: string[];
  artists: PublishedArtist[];
  releaseDate: string | null;
  releaseDatePrecision: ReleaseDatePrecision | null;
  releaseYear: number | null;
  albumType: ReleaseType;
  cover: PublishedCover;
  thumbnailPath: string | null;
  discoveredAt: string;
  sourceMarketChannels: SourceMarketChannel[];
  coreGenres: string[];
  relatedGenres: string[];
  contexts: string[];
  rymRating: number | null;
  rymRatingCount: number | null;
  editorial: AlbumEditorial | null;
  searchText: string;
}

export interface PublishedArtistIndex {
  artistId: string;
  neteaseArtistId: string;
  slug: string;
  name: string;
  aliases: string[];
  albumCount: number;
  albumCountByType: Partial<Record<ReleaseType, number>>;
  earliestYear: number | null;
  latestYear: number | null;
  commonCoreGenres: string[];
  albumIds: string[];
  previewCovers: string[];
}

export interface CatalogTaxonomy {
  key: string;
  labelZh: string | null;
  labelEn: string;
  kind: "core" | "related";
}

export interface DescriptorTaxonomy {
  key: string;
  labelZh: string | null;
  labelEn: string;
  kind: "descriptor";
}

export interface PublishedCatalog {
  version: 2;
  refreshDate: string;
  source: {
    catalog: "netease";
    endpointFamily: string;
    generatedAt: string;
    parserVersion: string;
    runtimeRequestsAllowed: false;
    taxonomy: "rym-offline-or-manual-core";
  };
  taxonomy: CatalogTaxonomy[];
  descriptorTaxonomy: DescriptorTaxonomy[];
  albums: PublishedAlbum[];
}

export interface PublishedCatalogIndex extends Omit<PublishedCatalog, "albums"> {
  albums: PublishedAlbumSummary[];
}

export interface PublishedArtistCatalog {
  version: 1;
  generatedAt: string;
  artists: PublishedArtistIndex[];
}

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  album: "专辑",
  ep: "EP",
  mixtape: "Mixtape",
  soundtrack: "原声专辑",
};

export function formatPartialDate(value: string | null, precision: ReleaseDatePrecision | null) {
  if (!value || !precision) return "发行日期暂缺";
  const [year, month, day] = value.split("-");
  if (precision === "year") return `${year} 年`;
  if (precision === "month") return `${year} 年 ${Number(month)} 月`;
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}
