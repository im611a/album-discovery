import { buildArtistCollectionAlbumHref, inspectArtistCollectionNavigationAuthority } from "./artist-collection-navigation";
import type {
  ArtistCollectionAlbumEntry,
  ArtistCollectionPrimaryStatus,
  ArtistCollectionProjection,
} from "./artist-collection";
import type { PublishedAlbumSummary } from "./schema";

export const ARTIST_COLLECTION_RESPONSIVE_CONTRACT = Object.freeze({
  viewports: Object.freeze([390, 768, 1024, 1280, 1440, 2048] as const),
  zoom: 2,
  contentOrder: Object.freeze(["ARTIST_IDENTITY", "CHRONOLOGY", "COLLECTION_CONTEXT", "CONTINUATION"] as const),
  mobileRule: "Preserve Artist identity and chronology before subordinate collection context; do not shrink a desktop dashboard.",
  reducedMotion: "No motion is required by this presentation model.",
});

const STATUS_COPY: Readonly<Record<ArtistCollectionPrimaryStatus, Readonly<{
  label: string;
  accessibleLabel: string;
  tone: "positive" | "neutral" | "negative";
}>>> = Object.freeze({
  FAVORITE: Object.freeze({ label: "收藏", accessibleLabel: "已在当前设备收藏", tone: "positive" }),
  LIKED: Object.freeze({ label: "喜欢", accessibleLabel: "已在当前设备标记喜欢", tone: "positive" }),
  SAVED: Object.freeze({ label: "想听", accessibleLabel: "已加入当前设备想听", tone: "positive" }),
  MARKED_LISTENED: Object.freeze({ label: "标记听过", accessibleLabel: "已明确标记听过；不是播放记录", tone: "neutral" }),
  DISMISSED: Object.freeze({ label: "不适合我", accessibleLabel: "已明确标记为不适合；不作为正向馆藏证据", tone: "negative" }),
  RECENTLY_VIEWED: Object.freeze({ label: "最近查看", accessibleLabel: "最近打开过这张专辑页面；浏览不等于收听", tone: "neutral" }),
  NONE: Object.freeze({ label: "未保留", accessibleLabel: "当前设备没有这张专辑的保留状态", tone: "neutral" }),
});

export interface ArtistCollectionWorkPresentation {
  readonly albumId: string;
  readonly slug: string;
  readonly title: string;
  readonly href: string;
  readonly chronologyPosition: number;
  readonly releaseDateLabel: string;
  readonly creditLabel: string;
  readonly primaryStatus: ArtistCollectionPrimaryStatus;
  readonly status: (typeof STATUS_COPY)[ArtistCollectionPrimaryStatus];
  readonly recentlyViewed: boolean;
  readonly accessibleLabel: string;
}

export interface ArtistCollectionPresentationModel {
  readonly artist: ArtistCollectionProjection["artist"];
  readonly hierarchy: Readonly<{
    primary: "ARTIST_ARCHIVE_CHRONOLOGY";
    secondary: "CURRENT_DEVICE_COLLECTION_CONTEXT";
  }>;
  readonly chronology: readonly ArtistCollectionWorkPresentation[];
  readonly collection: Readonly<{
    mode: "INLINE_SINGLE_WORK" | "SECONDARY_MULTI_WORK";
    shape: ArtistCollectionProjection["summary"]["collectionShape"];
    heading: string;
    summaryCopy: string;
    accessibleSummary: string;
    metrics: readonly Readonly<{ key: string; label: string; count: number }>[];
    contextualWorks: readonly ArtistCollectionWorkPresentation[];
    keptWorks: readonly ArtistCollectionWorkPresentation[];
    remainingWorks: readonly ArtistCollectionWorkPresentation[];
    recentlyViewedWorks: readonly ArtistCollectionWorkPresentation[];
    duplicateChronologyCards: false;
  }>;
  readonly navigation: ReturnType<typeof inspectArtistCollectionNavigationAuthority>;
  readonly accessibility: Readonly<{
    semanticHeadingRequired: true;
    realLinksRequired: true;
    focusVisibleRequired: true;
    nonColorStateLabelsRequired: true;
    screenReaderSummary: string;
  }>;
  readonly responsive: typeof ARTIST_COLLECTION_RESPONSIVE_CONTRACT;
}

function work(entry: ArtistCollectionAlbumEntry, artistSlug: string, searchParams: string | URLSearchParams, catalog: readonly PublishedAlbumSummary[]): ArtistCollectionWorkPresentation {
  const href = buildArtistCollectionAlbumHref({ targetSlug: entry.slug, originArtistSlug: artistSlug, searchParams, catalog });
  if (!href) throw new Error(`Unresolved Artist collection presentation target: ${entry.albumId}`);
  const status = STATUS_COPY[entry.primaryStatus];
  const creditLabel = entry.credit.kind === "SHARED_CREDIT"
    ? `共同署名作品 · ${entry.credit.count} 位艺人`
    : "独立署名作品";
  return Object.freeze({
    albumId: entry.albumId,
    slug: entry.slug,
    title: entry.album.title,
    href,
    chronologyPosition: entry.chronologyPosition,
    releaseDateLabel: entry.album.releaseDate ?? "发行日期暂缺",
    creditLabel,
    primaryStatus: entry.primaryStatus,
    status,
    recentlyViewed: entry.states.recentlyViewed,
    accessibleLabel: `查看《${entry.album.title}》专辑详情；${creditLabel}；${status.accessibleLabel}`,
  });
}

function summaryCopy(projection: ArtistCollectionProjection) {
  const { artist, summary } = projection;
  if (summary.keptWorksCount === 0) {
    return summary.recentlyViewedWorksCount
      ? `当前设备没有保留 ${artist.name} 的专辑；最近查看过 ${summary.recentlyViewedWorksCount} 张。`
      : `当前设备还没有保留 ${artist.name} 的专辑。`;
  }
  const details = [
    summary.listenLaterWorksCount ? `想听 ${summary.listenLaterWorksCount} 张` : null,
    summary.likedWorksCount ? `喜欢 ${summary.likedWorksCount} 张` : null,
    summary.favoriteWorksCount ? `收藏 ${summary.favoriteWorksCount} 张` : null,
    summary.markedListenedWorksCount ? `标记听过 ${summary.markedListenedWorksCount} 张` : null,
  ].filter(Boolean).join("、");
  return `你的本机专辑中有 ${summary.keptWorksCount} 张来自 ${artist.name}${details ? `；${details}` : ""}。`;
}

export function buildArtistCollectionPresentationModel({
  projection,
  catalog,
  searchParams = "",
}: {
  projection: ArtistCollectionProjection;
  catalog: readonly PublishedAlbumSummary[];
  searchParams?: string | URLSearchParams;
}): ArtistCollectionPresentationModel {
  const presentations = new Map(projection.publishedAlbums.map((entry) => [entry.albumId, work(entry, projection.artist.slug, searchParams, catalog)] as const));
  const select = (entries: readonly ArtistCollectionAlbumEntry[]) => Object.freeze(entries.map((entry) => {
    const item = presentations.get(entry.albumId);
    if (!item) throw new Error(`Missing Artist collection work presentation: ${entry.albumId}`);
    return item;
  }));
  const copy = summaryCopy(projection);
  const metrics = Object.freeze([
    projection.summary.keptWorksCount ? Object.freeze({ key: "kept", label: "本机保留", count: projection.summary.keptWorksCount }) : null,
    projection.summary.listenLaterWorksCount ? Object.freeze({ key: "saved", label: "想听", count: projection.summary.listenLaterWorksCount }) : null,
    projection.summary.likedWorksCount ? Object.freeze({ key: "liked", label: "喜欢", count: projection.summary.likedWorksCount }) : null,
    projection.summary.favoriteWorksCount ? Object.freeze({ key: "favorite", label: "收藏", count: projection.summary.favoriteWorksCount }) : null,
    projection.summary.markedListenedWorksCount ? Object.freeze({ key: "listened", label: "标记听过", count: projection.summary.markedListenedWorksCount }) : null,
    projection.summary.recentlyViewedWorksCount ? Object.freeze({ key: "recent", label: "最近查看", count: projection.summary.recentlyViewedWorksCount }) : null,
    projection.summary.dismissedWorksCount ? Object.freeze({ key: "dismissed", label: "不适合", count: projection.summary.dismissedWorksCount }) : null,
  ].filter((item) => item !== null));
  const contextualEntries = projection.publishedAlbums.filter((entry) => entry.kept || entry.states.dismissed || entry.states.recentlyViewed);
  return Object.freeze({
    artist: projection.artist,
    hierarchy: Object.freeze({
      primary: "ARTIST_ARCHIVE_CHRONOLOGY",
      secondary: "CURRENT_DEVICE_COLLECTION_CONTEXT",
    }),
    chronology: select(projection.publishedAlbums),
    collection: Object.freeze({
      mode: projection.artist.catalogShape === "SINGLE_WORK" ? "INLINE_SINGLE_WORK" : "SECONDARY_MULTI_WORK",
      shape: projection.summary.collectionShape,
      heading: "这位艺人与我的专辑",
      summaryCopy: copy,
      accessibleSummary: `${projection.artist.name} 共收录 ${projection.summary.publishedWorksCount} 张专辑；当前设备保留 ${projection.summary.keptWorksCount} 张；最近查看 ${projection.summary.recentlyViewedWorksCount} 张。`,
      metrics,
      contextualWorks: projection.artist.catalogShape === "SINGLE_WORK" ? Object.freeze([]) : select(contextualEntries),
      keptWorks: projection.artist.catalogShape === "SINGLE_WORK" ? Object.freeze([]) : select(projection.keptAlbums),
      remainingWorks: projection.artist.catalogShape === "SINGLE_WORK" ? Object.freeze([]) : select(projection.uncollectedPublishedAlbums),
      recentlyViewedWorks: projection.artist.catalogShape === "SINGLE_WORK" ? Object.freeze([]) : select(projection.recentlyViewedAlbums),
      duplicateChronologyCards: false,
    }),
    navigation: inspectArtistCollectionNavigationAuthority(searchParams, catalog),
    accessibility: Object.freeze({
      semanticHeadingRequired: true,
      realLinksRequired: true,
      focusVisibleRequired: true,
      nonColorStateLabelsRequired: true,
      screenReaderSummary: `${copy} 艺人作品年表仍是本页主要内容。`,
    }),
    responsive: ARTIST_COLLECTION_RESPONSIVE_CONTRACT,
  });
}
