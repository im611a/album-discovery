import type { LocalUserStateV1 } from "@/features/personal-state/schema";
import { getAlbumDetailBySlug } from "./published-album-details";
import { catalogAlbums } from "./published-catalog";
import { getRelatedAlbums } from "./queries";
import type { PublishedAlbum } from "./schema";

export interface AlbumDetailViewModel {
  album: PublishedAlbum;
  rating: {
    visible: boolean;
    value: number | null;
    count: number | null;
    reference: string | null;
  };
  taxonomy: {
    primaryGenres: string[];
    secondaryGenres: string[];
    scenes: string[];
  };
  externalLinks: Array<{
    platform: "netease";
    label: "网易云音乐";
    href: string;
  }>;
  recommendations: ReturnType<typeof getRelatedAlbums>;
  userStatus: {
    liked: boolean;
    favorite: boolean;
    saved: boolean;
    listened: boolean;
    dismissed: boolean;
  };
}

function canonicalNeteaseAlbumUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "music.163.com") return null;
    if (!url.hash.startsWith("#/album?id=") && !url.pathname.startsWith("/album")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildAlbumDetailViewModel(
  album: PublishedAlbum,
  userState?: LocalUserStateV1 | null,
): AlbumDetailViewModel {
  const summary = catalogAlbums.find((item) => item.id === album.id);
  if (!summary || summary.slug !== album.slug) {
    throw new Error(`专辑详情与目录索引不一致：${album.id}`);
  }
  const neteaseUrl = canonicalNeteaseAlbumUrl(album.externalUrl);
  const ids = {
    liked: new Set(userState?.likedAlbumIds ?? []),
    favorite: new Set(userState?.favoriteAlbumIds ?? []),
    saved: new Set(userState?.savedAlbumIds ?? []),
    listened: new Set(userState?.listenedAlbumIds ?? []),
    dismissed: new Set(userState?.dismissedAlbumIds ?? []),
  };
  return {
    album,
    rating: {
      visible: album.rymRating != null,
      value: album.rymRating,
      count: album.rymRatingCount,
      reference: album.rymReference?.startsWith("https://rateyourmusic.com/") ? album.rymReference : null,
    },
    taxonomy: {
      primaryGenres: [...album.coreGenres],
      secondaryGenres: [...album.relatedGenres],
      scenes: [...album.contexts],
    },
    externalLinks: neteaseUrl
      ? [{ platform: "netease", label: "网易云音乐", href: neteaseUrl }]
      : [],
    recommendations: getRelatedAlbums(summary),
    userStatus: {
      liked: ids.liked.has(album.id),
      favorite: ids.favorite.has(album.id),
      saved: ids.saved.has(album.id),
      listened: ids.listened.has(album.id),
      dismissed: ids.dismissed.has(album.id),
    },
  };
}

export function getAlbumDetailViewModel(
  slug: string,
  userState?: LocalUserStateV1 | null,
) {
  const album = getAlbumDetailBySlug(slug);
  return album ? buildAlbumDetailViewModel(album, userState) : null;
}

export function getAlbumDetailStaticParams() {
  const params = catalogAlbums.map((album) => ({ slug: album.slug }));
  if (new Set(params.map((item) => item.slug)).size !== params.length) {
    throw new Error("专辑详情静态参数包含重复 slug。");
  }
  return params;
}
