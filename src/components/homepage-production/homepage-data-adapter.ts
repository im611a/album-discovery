import { catalogAlbums } from "@/catalog/published-catalog";
import type { PublishedAlbumSummary } from "@/catalog/schema";
import { withBasePath } from "@/lib/site-path";
import { APPROVED_HOMEPAGE_MAPPING } from "./approved-homepage-mapping";
import {
  getHomepageStageVinylPalette,
  type AlbumVinylPalette,
} from "./homepage-vinyl-palettes";

export interface HomepageAlbum {
  index: number;
  albumId: string;
  slug: string;
  title: string;
  artists: string[];
  cover: string;
  releaseYear: number | null;
  displayNumber?: string;
}

export interface HomepageStageAlbum extends HomepageAlbum {
  vinylPalette: AlbumVinylPalette;
}

function resolveAlbum(
  entry: { albumId: string; slug: string },
  index: number,
  displayNumber?: string,
): HomepageAlbum {
  const album = catalogAlbums.find((candidate) => candidate.id === entry.albumId);
  if (!album) throw new Error(`首页批准映射中的专辑不存在：${entry.albumId}`);
  if (album.slug !== entry.slug) {
    throw new Error(`首页批准映射 slug 不匹配：${entry.albumId} (${entry.slug} !== ${album.slug})`);
  }
  const cover = album.cover.src ?? album.cover.thumbnailSrc;
  if (!cover || !cover.startsWith("/")) {
    throw new Error(`首页批准映射缺少本地封面：${entry.albumId}`);
  }
  return {
    index,
    albumId: album.id,
    slug: album.slug,
    title: album.title,
    artists: album.artists.map((artist) => artist.name),
    cover: withBasePath(cover),
    releaseYear: album.releaseYear,
    ...(displayNumber ? { displayNumber } : {}),
  };
}

export function buildHomepageContent(albums: readonly PublishedAlbumSummary[] = catalogAlbums) {
  const byId = new Map(albums.map((album) => [album.id, album]));
  const resolveFrom = (
    entry: { albumId: string; slug: string },
    index: number,
    displayNumber?: string,
  ) => {
    const album = byId.get(entry.albumId);
    if (!album) throw new Error(`首页批准映射中的专辑不存在：${entry.albumId}`);
    if (album.slug !== entry.slug) {
      throw new Error(`首页批准映射 slug 不匹配：${entry.albumId} (${entry.slug} !== ${album.slug})`);
    }
    const cover = album.cover.src ?? album.cover.thumbnailSrc;
    if (!cover?.startsWith("/")) throw new Error(`首页批准映射缺少本地封面：${entry.albumId}`);
    return {
      index,
      albumId: album.id,
      slug: album.slug,
      title: album.title,
      artists: album.artists.map((artist) => artist.name),
      cover: withBasePath(cover),
      releaseYear: album.releaseYear,
      ...(displayNumber ? { displayNumber } : {}),
    } satisfies HomepageAlbum;
  };

  const gallery = APPROVED_HOMEPAGE_MAPPING.gallery.map((entry, index) =>
    resolveFrom(entry, index + 1),
  );
  const stage = APPROVED_HOMEPAGE_MAPPING.stage.map((entry, index) =>
    ({
      ...resolveFrom(entry, index + 1, entry.displayNumber),
      vinylPalette: getHomepageStageVinylPalette(entry.albumId),
    }) satisfies HomepageStageAlbum,
  );
  const reserve = APPROVED_HOMEPAGE_MAPPING.reserve.map((entry, index) =>
    resolveFrom(entry, index + 1),
  );
  const usedIds = [...gallery, ...stage].map((album) => album.albumId);
  if (new Set(usedIds).size !== 30) throw new Error("首页 Gallery 与 Stage 必须使用 30 张不重复专辑。");
  if (reserve.some((album) => usedIds.includes(album.albumId))) {
    throw new Error("首页 Reserve 专辑不得进入 Gallery 或 Stage。");
  }
  return { gallery, stage, reserve };
}

export const homepageContent = buildHomepageContent();
export const resolveHomepageAlbum = resolveAlbum;
