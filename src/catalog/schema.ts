export type ReleaseDatePrecision = "year" | "month" | "day";
export type ReleaseType = "album" | "ep" | "single" | "mixtape" | "soundtrack" | "live" | "compilation" | "other";
export type SourceMarketChannel = "ALL" | "ZH" | "EA" | "JP" | "KR";

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
  descriptors: string[];
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
  descriptors: string[];
  contexts: string[];
  editorial: AlbumEditorial | null;
  searchText: string;
}

export interface CatalogTaxonomy {
  key: string;
  labelZh: string;
  labelEn: string;
  kind: "core" | "related";
}

export interface DescriptorTaxonomy {
  key: string;
  label: string;
  kind: "descriptor";
}

export interface PublishedCatalog {
  version: 2;
  refreshDate: string;
  source: {
    catalog: "netease";
    endpointFamily: string;
    generatedAt: string;
    runtimeRequestsAllowed: false;
  };
  taxonomy: CatalogTaxonomy[];
  descriptorTaxonomy: DescriptorTaxonomy[];
  albums: PublishedAlbum[];
}

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  album: "专辑",
  ep: "EP",
  single: "单曲",
  mixtape: "Mixtape",
  soundtrack: "原声专辑",
  live: "现场专辑",
  compilation: "精选集",
  other: "其他",
};

export function formatPartialDate(value: string | null, precision: ReleaseDatePrecision | null) {
  if (!value || !precision) return "发行日期暂缺";
  const [year, month, day] = value.split("-");
  if (precision === "year") return `${year} 年`;
  if (precision === "month") return `${year} 年 ${Number(month)} 月`;
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}
