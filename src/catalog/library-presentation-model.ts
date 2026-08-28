import { RELEASE_TYPE_LABELS, type PublishedAlbumSummary } from "./schema";
import { appendNavigationOrigin } from "./navigation-origin";
import {
  buildLibraryAlbumHref,
  serializeLibraryQuery,
  type LibraryAlbumEntry,
  type LibraryFacet,
  type LibraryMembershipReason,
  type LibraryProjection,
  type LibraryQuery,
  type LibraryView,
} from "./collection-presentation";

export type LibraryContentPriority = "ESSENTIAL" | "SECONDARY" | "OPTIONAL";
export type LibrarySectionKind = "DURABLE_COLLECTION" | "RECENT_BROWSING" | "DISMISSED_REVIEW";
export type LibraryRecoveryKind = "NONE" | "STALE_REFERENCES_RECONCILED" | "LOCAL_STATE_RECOVERED" | "STORAGE_UNAVAILABLE";

export interface LibraryPresentationContext {
  readonly recoveryKind?: LibraryRecoveryKind;
}

export interface LibraryPresentationAction {
  readonly label: string;
  readonly accessibleLabel: string;
  readonly href: string;
}

export interface LibraryEmptyStatePresentation {
  readonly kind:
    | "FRESH_LIBRARY"
    | "EMPTY_COLLECTION_FACET"
    | "NO_QUERY_MATCH"
    | "NO_RECENT_VIEWS"
    | "STALE_REFERENCES_RECONCILED"
    | "LOCAL_STATE_RECOVERED";
  readonly title: string;
  readonly supportingCopy: string;
  readonly actions: readonly LibraryPresentationAction[];
  readonly accessibleMeaning: string;
}

export interface LibraryStatusPresentation {
  readonly key: LibraryMembershipReason | "DISMISSED";
  readonly label: string;
  readonly accessibleLabel: string;
  readonly tone: "positive" | "factual" | "negative";
}

export interface LibraryAlbumCardPresentation {
  readonly stableKey: string;
  readonly albumId: string;
  readonly slug: string;
  readonly href: string;
  readonly album: PublishedAlbumSummary;
  readonly cover: Readonly<{
    kind: PublishedAlbumSummary["cover"]["kind"];
    src: string | null;
    alt: string;
  }>;
  readonly title: string;
  readonly artists: readonly Readonly<{ name: string; href: string }>[];
  readonly artistDisplay: string;
  readonly releaseYearLabel: string;
  readonly releaseTypeLabel: string;
  readonly statuses: readonly LibraryStatusPresentation[];
  readonly recentlyViewed: boolean;
  readonly accessibleLabel: string;
  readonly variants: readonly ["compact", "standard"];
  readonly contentPriority: Readonly<{
    cover: "ESSENTIAL";
    title: "ESSENTIAL";
    artist: "ESSENTIAL";
    state: "SECONDARY";
    releaseYear: "SECONDARY";
    releaseType: "OPTIONAL";
  }>;
}

export interface LibraryFacetPresentation {
  readonly key: LibraryFacet;
  readonly group: "COLLECTION" | "REVIEW" | "ACTIVITY";
  readonly label: string;
  readonly semanticNote: string;
  readonly count: number;
  readonly selected: boolean;
  readonly href: string;
  readonly accessibleLabel: string;
  readonly zeroCountBehavior: "VISIBLE";
}

export interface LibraryPresentationSection {
  readonly kind: LibrarySectionKind;
  readonly visible: boolean;
  readonly heading: string;
  readonly description: string;
  readonly count: number;
  readonly countLabel: string;
  readonly entries: readonly LibraryAlbumCardPresentation[];
  readonly emptyState: LibraryEmptyStatePresentation | null;
  readonly independentOfCollectionFacet: boolean;
}

export interface LibraryPresentationModel {
  readonly query: LibraryQuery;
  readonly header: Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    localOnlyNote: string;
  }>;
  readonly summary: Readonly<{
    heading: string;
    accessibleLabel: string;
    facts: readonly Readonly<{
      key: "total" | "saved" | "liked" | "favorite" | "marked-listened" | "recent";
      label: string;
      value: number;
      priority: LibraryContentPriority;
    }>[];
  }>;
  readonly facets: readonly LibraryFacetPresentation[];
  readonly primaryCollection: LibraryPresentationSection;
  readonly recent: LibraryPresentationSection;
  readonly pageEmptyState: LibraryEmptyStatePresentation | null;
  readonly navigation: Readonly<{
    origin: "library";
    nativeHistoryOnly: true;
    queryBound: true;
    albumContextBound: true;
  }>;
  readonly responsive: typeof LIBRARY_RESPONSIVE_CONTENT_PRIORITY;
}

const STATUS_COPY: Readonly<Record<LibraryMembershipReason, LibraryStatusPresentation>> = Object.freeze({
  SAVED: Object.freeze({ key: "SAVED", label: "想听", accessibleLabel: "已加入想听", tone: "positive" }),
  LIKED: Object.freeze({ key: "LIKED", label: "喜欢", accessibleLabel: "已标记喜欢", tone: "positive" }),
  FAVORITE: Object.freeze({ key: "FAVORITE", label: "收藏", accessibleLabel: "已收藏", tone: "positive" }),
  MARKED_LISTENED: Object.freeze({ key: "MARKED_LISTENED", label: "标记听过", accessibleLabel: "已标记听过", tone: "factual" }),
});

const DISMISSED_STATUS: LibraryStatusPresentation = Object.freeze({
  key: "DISMISSED",
  label: "不适合我",
  accessibleLabel: "已标记为不适合我",
  tone: "negative",
});

export const LIBRARY_RESPONSIVE_CONTENT_PRIORITY = Object.freeze({
  viewports: Object.freeze([390, 768, 1024, 1280, 1440, 2048] as const),
  essential: Object.freeze(["page-heading", "section-heading", "facet-name", "facet-count", "album-cover", "album-title", "album-artist", "primary-album-link", "empty-state-action"] as const),
  secondary: Object.freeze(["summary-total", "state-label", "release-year", "recent-semantics", "result-count"] as const),
  optional: Object.freeze(["release-type", "secondary-summary-facts", "long-semantic-note"] as const),
  mobile390: Object.freeze({
    preserve: Object.freeze(["identity", "facet-selection", "album-identity", "state-meaning", "primary-action"] as const),
    mayCollapse: Object.freeze(["secondary-summary-facts", "long-semantic-note", "release-type"] as const),
  }),
});

export const LIBRARY_PAGE_IDENTITY = Object.freeze({
  eyebrow: "CURRENT-DEVICE LIBRARY",
  title: "我的专辑",
  description: "收藏与最近查看，只保存在当前设备。",
});

function libraryHref(query: LibraryQuery) {
  const serialized = serializeLibraryQuery(query);
  return serialized ? `/library?${serialized}` : "/library";
}

function action(label: string, accessibleLabel: string, href: string): LibraryPresentationAction {
  return Object.freeze({ label, accessibleLabel, href });
}

function emptyState(
  kind: LibraryEmptyStatePresentation["kind"],
  query: LibraryQuery,
  facetLabel: string,
): LibraryEmptyStatePresentation {
  if (kind === "NO_QUERY_MATCH") {
    return Object.freeze({
      kind,
      title: "当前分类中没有匹配专辑",
      supportingCopy: `“${query.query}”没有匹配当前分类；可以清除关键词继续查看。`,
      actions: Object.freeze([action("清除关键词", "清除当前 Library 关键词", libraryHref({ ...query, query: "" }))]),
      accessibleMeaning: "筛选结果为空，当前 Library 分类和排序保持不变。",
    });
  }
  if (kind === "NO_RECENT_VIEWS") {
    return Object.freeze({
      kind,
      title: "还没有最近查看的专辑",
      supportingCopy: "打开专辑导览后，它会出现在当前设备的最近查看中；这不是播放或收听记录。",
      actions: Object.freeze([action("浏览专辑目录", "前往专辑发现目录", "/discover")]),
      accessibleMeaning: "当前设备没有可显示的专辑浏览记录。",
    });
  }
  if (kind === "STALE_REFERENCES_RECONCILED") {
    return Object.freeze({
      kind,
      title: "当前目录中暂无可返回的专辑",
      supportingCopy: "这里只显示仍存在于当前发布目录中的专辑；无法解析的旧记录不会生成替代专辑。",
      actions: Object.freeze([action("重新浏览目录", "前往当前专辑目录", "/discover")]),
      accessibleMeaning: "旧记录已安全对照当前目录，当前没有可显示结果。",
    });
  }
  if (kind === "LOCAL_STATE_RECOVERED") {
    return Object.freeze({
      kind,
      title: "可以从新的本机清单继续",
      supportingCopy: "现有本机清单未能完整读取，页面已安全回到空白状态，没有补造任何专辑或行为。",
      actions: Object.freeze([action("管理本机数据", "前往设置管理本机专辑数据", "/settings")]),
      accessibleMeaning: "本机状态已安全恢复为空白，可从设置或目录继续。",
    });
  }
  if (kind === "EMPTY_COLLECTION_FACET") {
    return Object.freeze({
      kind,
      title: `${facetLabel}中还没有专辑`,
      supportingCopy: "在专辑页面明确标记相应状态后，当前设备上的专辑会显示在这里。",
      actions: Object.freeze([action("去发现专辑", "前往发现页查找专辑", "/discover")]),
      accessibleMeaning: `当前 ${facetLabel} 分类为空。`,
    });
  }
  return Object.freeze({
    kind: "FRESH_LIBRARY",
    title: "这里还没有收藏或最近查看",
    supportingCopy: "在专辑页面收藏一张作品，或打开专辑导览后再回到这里。既有本机信号仍保留用于兼容推荐，但不作为 Library 分类展示。",
    actions: Object.freeze([
      action("浏览专辑目录", "前往发现页浏览专辑目录", "/discover"),
      action("查看本机推荐", "前往为你推荐", "/for-you"),
      action("浏览艺人档案", "前往艺人档案继续浏览", "/artists"),
    ]),
    accessibleMeaning: "当前 Library 没有保留专辑、最近查看或不适合记录。",
  });
}

function facetGroup(facet: LibraryFacet): LibraryFacetPresentation["group"] {
  if (facet === "dismissed") return "REVIEW";
  if (facet === "recent") return "ACTIVITY";
  return "COLLECTION";
}

function card(
  entry: LibraryAlbumEntry,
  query: LibraryQuery,
  catalog: readonly PublishedAlbumSummary[],
): LibraryAlbumCardPresentation {
  const href = buildLibraryAlbumHref({
    targetSlug: entry.slug,
    view: query.view,
    query: query.query,
    sort: query.sort,
    catalog,
  });
  if (!href) throw new Error(`R15 Library presentation received unresolved catalog entry: ${entry.albumId}`);
  const statuses = entry.membershipReasons.map((reason) => STATUS_COPY[reason]);
  if (entry.states.dismissed) statuses.push(DISMISSED_STATUS);
  const artistDisplay = entry.album.artists.map((artist) => artist.name).join("、") || "艺人信息暂缺";
  const stateSummary = statuses.map((status) => status.accessibleLabel).join("、");
  return Object.freeze({
    stableKey: entry.albumId,
    albumId: entry.albumId,
    slug: entry.slug,
    href,
    album: entry.album,
    cover: Object.freeze({
      kind: entry.album.cover.kind,
      src: entry.album.cover.thumbnailSrc ?? entry.album.cover.src,
      alt: entry.album.cover.alt,
    }),
    title: entry.album.title,
    artists: Object.freeze(entry.album.artists.map((artist) => Object.freeze({
      name: artist.name,
      href: appendNavigationOrigin(`/artists/artist-${artist.neteaseArtistId}`, {
        kind: "LIBRARY",
        view: query.view,
        query: query.query,
        sort: query.sort,
      }),
    }))),
    artistDisplay,
    releaseYearLabel: entry.album.releaseYear == null ? "发行年份暂缺" : String(entry.album.releaseYear),
    releaseTypeLabel: RELEASE_TYPE_LABELS[entry.album.albumType],
    statuses: Object.freeze(statuses),
    recentlyViewed: entry.recentlyViewed,
    accessibleLabel: `查看《${entry.album.title}》专辑导览，艺人 ${artistDisplay}${stateSummary ? `，${stateSummary}` : ""}`,
    variants: Object.freeze(["compact", "standard"] as const),
    contentPriority: Object.freeze({
      cover: "ESSENTIAL",
      title: "ESSENTIAL",
      artist: "ESSENTIAL",
      state: "SECONDARY",
      releaseYear: "SECONDARY",
      releaseType: "OPTIONAL",
    }),
  });
}

function cards(entries: readonly LibraryAlbumEntry[], query: LibraryQuery, catalog: readonly PublishedAlbumSummary[]) {
  const seen = new Set<string>();
  return Object.freeze(entries.flatMap((entry) => {
    if (seen.has(entry.albumId)) return [];
    seen.add(entry.albumId);
    return [card(entry, query, catalog)];
  }));
}

function collectionHeading(view: LibraryView, label: string) {
  if (view === "overview" || view === "favorite") return "收藏";
  if (view === "dismissed") return "复核不适合我的专辑";
  return label;
}

/**
 * Pure nonvisual adapter from the canonical R15-2A projection to a stable,
 * human-readable model. React remains responsible only for rendering it.
 */
export function buildLibraryPresentationModel({
  projection,
  catalog,
  context = {},
}: {
  projection: LibraryProjection;
  catalog: readonly PublishedAlbumSummary[];
  context?: LibraryPresentationContext;
}): LibraryPresentationModel {
  const selectedFacet = projection.facets.find((facet) => facet.facet === (projection.query.view === "overview" ? "all" : projection.query.view));
  if (!selectedFacet) throw new Error(`Missing Library facet presentation authority for ${projection.query.view}`);
  const facets = Object.freeze(projection.facets.filter((facet) => facet.facet === "favorite" || facet.facet === "recent").map((facet): LibraryFacetPresentation => {
    const selected = projection.query.view === "overview" ? facet.facet === "favorite" : facet.facet === projection.query.view;
    const nextQuery = { ...projection.query, view: facet.facet };
    return Object.freeze({
      key: facet.facet,
      group: facetGroup(facet.facet),
      label: facet.label,
      semanticNote: facet.semanticNote,
      count: facet.count,
      selected,
      href: libraryHref(nextQuery),
      accessibleLabel: `${facet.label}，${facet.count} 张${selected ? "，当前分类" : ""}`,
      zeroCountBehavior: "VISIBLE",
    });
  }));
  const view = projection.query.view;
  const collectionVisible = view !== "recent";
  const recentVisible = view === "overview" || view === "recent";
  const collectionKind: LibrarySectionKind = view === "dismissed" ? "DISMISSED_REVIEW" : "DURABLE_COLLECTION";
  const collectionEntries = collectionVisible
    ? cards(projection.entries, projection.query, catalog)
    : Object.freeze([]);
  const recentSource = view === "recent" ? projection.entries : projection.recentEntries;
  const recentEntries = cards(recentSource, { ...projection.query, view: "recent" }, catalog);
  const recoveryKind = context.recoveryKind ?? "NONE";
  const pageEmptyState = projection.emptyReason === "FRESH"
    ? emptyState(
      recoveryKind === "STALE_REFERENCES_RECONCILED"
        ? "STALE_REFERENCES_RECONCILED"
        : recoveryKind === "LOCAL_STATE_RECOVERED"
          ? "LOCAL_STATE_RECOVERED"
          : "FRESH_LIBRARY",
      projection.query,
      selectedFacet.label,
    )
    : null;
  const collectionEmptyState = collectionVisible && collectionEntries.length === 0 && !pageEmptyState
    ? emptyState(projection.emptyReason === "NO_QUERY_MATCH" ? "NO_QUERY_MATCH" : "EMPTY_COLLECTION_FACET", projection.query, selectedFacet.label)
    : null;
  const recentEmptyState = recentVisible && recentEntries.length === 0 && !pageEmptyState
    ? emptyState(projection.emptyReason === "NO_QUERY_MATCH" && view === "recent" ? "NO_QUERY_MATCH" : "NO_RECENT_VIEWS", projection.query, selectedFacet.label)
    : null;

  return Object.freeze({
    query: projection.query,
    header: Object.freeze({
      ...LIBRARY_PAGE_IDENTITY,
      localOnlyNote: recoveryKind === "STORAGE_UNAVAILABLE"
        ? "本次会话仍可使用，但当前设备无法确认持久保存。"
        : "这些状态只保存在当前设备。",
    }),
    summary: Object.freeze({
      heading: "本机专辑概览",
      accessibleLabel: `当前设备保留 ${projection.summary.totalLibraryAlbums} 张专辑，最近查看 ${projection.summary.recentlyViewedCount} 张。`,
      facts: Object.freeze([
        Object.freeze({ key: "favorite", label: "收藏", value: projection.summary.favoriteCount, priority: "ESSENTIAL" as const }),
        Object.freeze({ key: "recent", label: "最近查看", value: projection.summary.recentlyViewedCount, priority: "ESSENTIAL" as const }),
      ]),
    }),
    facets,
    primaryCollection: Object.freeze({
      kind: collectionKind,
      visible: collectionVisible,
      heading: collectionHeading(view, selectedFacet.label),
      description: selectedFacet.semanticNote,
      count: collectionEntries.length,
      countLabel: `当前分类 ${collectionEntries.length} 张`,
      entries: collectionEntries,
      emptyState: collectionEmptyState,
      independentOfCollectionFacet: false,
    }),
    recent: Object.freeze({
      kind: "RECENT_BROWSING",
      visible: recentVisible,
      heading: "最近查看",
      description: "最近打开过的专辑页面，按本机浏览顺序排列；它们不因此进入保留清单。",
      count: recentEntries.length,
      countLabel: `最近查看 ${recentEntries.length} 张`,
      entries: recentEntries,
      emptyState: recentEmptyState,
      independentOfCollectionFacet: true,
    }),
    pageEmptyState,
    navigation: Object.freeze({
      origin: "library",
      nativeHistoryOnly: true,
      queryBound: true,
      albumContextBound: true,
    }),
    responsive: LIBRARY_RESPONSIVE_CONTENT_PRIORITY,
  });
}
