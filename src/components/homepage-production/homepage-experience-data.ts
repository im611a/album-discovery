import visualIndexJson from "@/data/generated/album-visual-index.json";
import relationshipIndexJson from "@/data/generated/homepage-relationship-index.json";
import { catalogAlbums } from "@/catalog/published-catalog";
import { withBasePath } from "@/lib/site-path";
import type { HomepageAlbum } from "./homepage-data-adapter";

export const CHROMATIC_TAXONOMY = [
  "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink",
  "mono", "dark", "multicolor",
] as const;

export type ChromaticTag = typeof CHROMATIC_TAXONOMY[number];

interface VisualRecord {
  albumId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  accentSecondaryColor: string;
  primaryHue: number;
  saturation: number;
  luminance: number;
  grayscaleRatio: number;
  darkRatio: number;
  visualColorTags: ChromaticTag[];
  primaryVisualColor: ChromaticTag;
}

export interface HomepageExperienceAlbum extends HomepageAlbum {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  accentSecondaryColor: string;
  primaryHue: number;
  saturation: number;
  luminance: number;
  visualColorTags: readonly ChromaticTag[];
  primaryVisualColor: ChromaticTag;
}

export interface HomepageRelationshipOption {
  albumId: string;
  lens: string;
}

export interface HomepageExperienceData {
  albums: Readonly<Record<string, HomepageExperienceAlbum>>;
  chromaticAlbumIds: Readonly<Record<ChromaticTag, readonly string[]>>;
  relationships: Readonly<Record<string, readonly HomepageRelationshipOption[]>>;
}

const visualIndex = visualIndexJson as { albums: VisualRecord[] };
const relationshipIndex = relationshipIndexJson as {
  relationships: { albumId: string; options: HomepageRelationshipOption[] }[];
};
let cachedExperience: HomepageExperienceData | null = null;

export function buildHomepageExperienceData(): HomepageExperienceData {
  if (cachedExperience) return cachedExperience;
  const visualById = new Map(visualIndex.albums.map((record) => [record.albumId, record]));
  const albums = Object.fromEntries(catalogAlbums.map((album, index) => {
    const visual = visualById.get(album.id);
    const cover = album.cover.thumbnailSrc ?? album.cover.src;
    if (!visual || !cover?.startsWith("/")) throw new Error(`首页体验索引缺少本地专辑证据：${album.id}`);
    return [album.id, {
      index: index + 1,
      albumId: album.id,
      slug: album.slug,
      title: album.title,
      artists: album.artists.map((artist) => artist.name),
      cover: withBasePath(cover),
      releaseYear: album.releaseYear,
      primaryColor: visual.primaryColor,
      secondaryColor: visual.secondaryColor,
      accentColor: visual.accentColor,
      accentSecondaryColor: visual.accentSecondaryColor,
      primaryHue: visual.primaryHue,
      saturation: visual.saturation,
      luminance: visual.luminance,
      visualColorTags: visual.visualColorTags,
      primaryVisualColor: visual.primaryVisualColor,
    } satisfies HomepageExperienceAlbum];
  }));
  const chromaticAlbumIds = Object.fromEntries(CHROMATIC_TAXONOMY.map((tag) => {
    const ids = visualIndex.albums
      .filter((record) => record.visualColorTags.includes(tag))
      .sort((left, right) => left.primaryHue - right.primaryHue
        || right.saturation - left.saturation
        || left.luminance - right.luminance
        || left.albumId.localeCompare(right.albumId))
      .slice(0, 10)
      .map((record) => record.albumId);
    if (ids.length < 6) throw new Error(`封面色彩入口 ${tag} 少于 6 张代表专辑。`);
    return [tag, Object.freeze(ids)];
  })) as Record<ChromaticTag, readonly string[]>;
  const relationships = Object.fromEntries(relationshipIndex.relationships.map((entry) => [
    entry.albumId,
    Object.freeze(entry.options.map((option) => Object.freeze({ ...option }))),
  ]));
  cachedExperience = Object.freeze({
    albums: Object.freeze(albums),
    chromaticAlbumIds: Object.freeze(chromaticAlbumIds),
    relationships: Object.freeze(relationships),
  });
  return cachedExperience;
}
