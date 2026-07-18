export type PartialDate = { value: string; precision: "year" | "month" | "day" };
export type ReleaseType = "album" | "ep" | "mixtape" | "live" | "compilation" | "other";

export interface PublishedArtist { id: string; name: string }
export interface PublishedTrack { id: string; title: string; trackNumber: number; discNumber: number; artists: string[]; durationMs: number | null }
export interface ExternalAlbumLink { platform: string; kind: "listen" | "purchase"; url: string; verified: true; verifiedAt: string; source: string }
export interface PublishedCover { kind: "local" | "fallback"; src: string | null; width: number; height: number; alt: string; sourceUrl: string | null; retrievedAt: string | null; reason?: string }
export interface AlbumEditorial {
  summaryZh: string;
  whyListenZh: string;
  bestFor: string[];
  startWithTrackId: string | null;
  listeningApproachZh: string | null;
  confidence: "curated" | "metadata_based";
  humanReviewed: boolean;
  factNotes: Array<{ text: string; sourceUrl: string }>;
  descriptors: string[];
}
export interface PublishedAlbum {
  id: string;
  slug: string;
  title: string;
  alternateTitles: string[];
  artists: PublishedArtist[];
  releaseDate: PartialDate | null;
  releaseType: ReleaseType;
  primaryGenres: string[];
  secondaryGenres: string[];
  descriptors: string[];
  contexts: string[];
  languages: { status: "verified" | "unavailable"; values: string[]; source: string | null };
  cover: PublishedCover;
  tracks: PublishedTrack[];
  externalLinks: ExternalAlbumLink[];
  musicbrainzReleaseGroupId: string;
  representativeReleaseId: string | null;
  editorial: AlbumEditorial | null;
  searchText: string;
  addedAt: string;
  sourceSummary: { identity: string; metadataUrl: string; refreshedAt: string; editorial: string | null };
}
export interface CatalogTaxonomy { key: string; labelZh: string; descriptionZh: string }
export interface PublishedCatalog { version: 1; refreshDate: string; attribution: Record<string, string>; taxonomy: CatalogTaxonomy[]; albums: PublishedAlbum[] }

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  album: "专辑", ep: "EP", mixtape: "Mixtape", live: "现场专辑", compilation: "精选集", other: "其他",
};

export function formatPartialDate(date: PartialDate | null) {
  if (!date) return "发行日期暂缺";
  const [year, month, day] = date.value.split("-");
  if (date.precision === "year") return `${year} 年`;
  if (date.precision === "month") return `${year} 年 ${Number(month)} 月`;
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}
