import { parseDiscoveryPathContext } from "./discovery/path-context";
import { publishedDiscoveryIndex } from "./discovery/published-index";
import { buildNavigationReturnHref, parseNavigationOrigin } from "./navigation-origin";
import { parsePersonalJourneyUrlContext } from "./personalization/path-context";
import type { PublishedAlbumSummary } from "./schema";
import { parseArtistReturnContext, resolveArtistReturnHref } from "./artist-return-context";

export type RecentReturnOrigin =
  | "LIBRARY_RECENT"
  | "LIBRARY_COLLECTION"
  | "SEARCH_RESULT"
  | "ARTIST_DISCOGRAPHY"
  | "ARTIST_PERSONAL_CONTINUATION"
  | "EXPLORE_PERSONAL"
  | "EXPLORE"
  | "HOME"
  | "FOR_YOU"
  | "DIRECT";

export interface RecentReturnContext {
  readonly origin: Exclude<RecentReturnOrigin, "DIRECT">;
  readonly href: string;
  readonly label: string;
  readonly detail: string;
}

function artistHref(entryKey: string | undefined) {
  return resolveArtistReturnHref(entryKey);
}

export function buildRecentReturnContext(
  input: string | URLSearchParams,
  catalog: readonly PublishedAlbumSummary[],
): RecentReturnContext | null {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const personal = parsePersonalJourneyUrlContext(params, catalog);
  const explicitArtist = parseArtistReturnContext(params);
  if (explicitArtist) {
    return Object.freeze({
      origin: personal.source === "artist" ? "ARTIST_PERSONAL_CONTINUATION" : "ARTIST_DISCOGRAPHY",
      href: explicitArtist,
      label: "返回这位艺人的作品",
      detail: personal.source === "artist" ? "回到艺人档案与本机延续位置" : "回到艺人作品年表",
    });
  }
  const navigation = parseNavigationOrigin(params);
  const navigationHref = buildNavigationReturnHref(navigation);
  if (navigation.kind === "LIBRARY" && navigationHref) {
    const recent = navigation.view === "recent";
    return Object.freeze({
      origin: recent ? "LIBRARY_RECENT" : "LIBRARY_COLLECTION",
      href: navigationHref,
      label: recent ? "返回最近查看" : "返回我的专辑",
      detail: navigation.query ? `保留筛选“${navigation.query}”` : recent ? "回到当前设备的最近浏览顺序" : "回到原馆藏分类",
    });
  }
  if (navigation.kind === "SEARCH" && navigationHref) {
    return Object.freeze({
      origin: "SEARCH_RESULT",
      href: navigationHref,
      label: "返回搜索结果",
      detail: navigation.query ? `回到“${navigation.query}”的结果` : "回到搜索",
    });
  }

  const discovery = parseDiscoveryPathContext(params, publishedDiscoveryIndex);
  const artist = artistHref(discovery.entryKind === "artist" ? discovery.entryKey : undefined);
  if (personal.source === "artist" && artist) {
    return Object.freeze({ origin: "ARTIST_PERSONAL_CONTINUATION", href: artist, label: "返回这位艺人的作品", detail: "回到艺人档案与本机延续位置" });
  }
  if (artist) {
    return Object.freeze({ origin: "ARTIST_DISCOGRAPHY", href: artist, label: "返回这位艺人的作品", detail: "回到艺人作品年表" });
  }
  if (personal.source === "explore") {
    return Object.freeze({ origin: "EXPLORE_PERSONAL", href: "/explore?mode=personal", label: "返回探索", detail: "回到当前设备的个人入口" });
  }
  if (discovery.entryKind === "explore") {
    return Object.freeze({ origin: "EXPLORE", href: "/explore", label: "返回探索", detail: "回到探索入口；关系与偶然入口仍保持独立" });
  }
  if (personal.source === "home") {
    return Object.freeze({ origin: "HOME", href: "/", label: "返回首页", detail: "回到刚才的首页浏览位置" });
  }
  if (personal.source === "for-you") {
    return Object.freeze({ origin: "FOR_YOU", href: "/for-you", label: "返回为你推荐", detail: "回到当前设备上的可解释推荐" });
  }
  return null;
}
