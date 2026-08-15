import { buildLibraryProjection, buildLibraryAlbumHref } from "./collection-presentation";
import type { PublishedAlbumSummary } from "./schema";

export const MAX_RECENT_RETURN_ITEMS = 6;

export interface RecentReturnItem {
  readonly album: PublishedAlbumSummary;
  readonly href: string;
  readonly position: number;
  readonly accessibleLabel: string;
}

export interface RecentReturnPresentation {
  readonly status: "EMPTY" | "READY";
  readonly heading: "最近查看";
  readonly description: string;
  readonly totalCount: number;
  readonly items: readonly RecentReturnItem[];
  readonly libraryHref: "/library?view=recent";
}

export function buildRecentReturnPresentation({
  state,
  catalog,
  limit = MAX_RECENT_RETURN_ITEMS,
}: {
  state: unknown;
  catalog: readonly PublishedAlbumSummary[];
  limit?: number;
}): RecentReturnPresentation {
  const boundedLimit = Math.max(0, Math.min(MAX_RECENT_RETURN_ITEMS, Math.floor(limit)));
  const projection = buildLibraryProjection({
    state,
    catalog,
    query: { view: "recent", query: "", sort: "catalog" },
  });
  const items = projection.recentEntries.slice(0, boundedLimit).map((entry, position) => {
    const href = buildLibraryAlbumHref({ targetSlug: entry.slug, view: "recent", catalog });
    if (!href) throw new Error(`Unresolved recent-return target: ${entry.albumId}`);
    return Object.freeze({
      album: entry.album,
      href,
      position,
      accessibleLabel: `返回查看《${entry.album.title}》；最近查看第 ${position + 1} 张`,
    });
  });
  return Object.freeze({
    status: items.length ? "READY" : "EMPTY",
    heading: "最近查看",
    description: items.length
      ? "当前设备上最近打开过的专辑页面；浏览不等于收听。"
      : "打开一张专辑后，可从这里回到最近浏览的作品。",
    totalCount: projection.summary.recentlyViewedCount,
    items: Object.freeze(items),
    libraryHref: "/library?view=recent",
  });
}
