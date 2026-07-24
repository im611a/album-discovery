import { buildDiscoverOptions, discoverAlbums, type CatalogSort } from "./queries";
import { catalogAlbums, catalogTaxonomy, getTaxonomyLabel } from "./published-catalog";
import { getListeningSceneLabel } from "./listening-scenes";
import type { PublishedAlbumSummary, ReleaseType } from "./schema";

export type TopicKind = "core" | "related" | "scene" | "decade";

export interface TopicSummary {
  kind: TopicKind;
  key: string;
  slug: string;
  label: string;
  count: number;
  previewAlbums: PublishedAlbumSummary[];
  commonCoreGenres: Array<{ key: string; count: number }>;
}

const topicAlbums = (kind: TopicKind, key: string, albums = catalogAlbums) => albums.filter((album) => {
  if (kind === "core") return album.coreGenres.includes(key);
  if (kind === "related") return album.relatedGenres.includes(key);
  if (kind === "scene") return album.contexts.includes(key);
  return album.releaseYear != null && `${Math.floor(album.releaseYear / 10) * 10}s` === key;
});

function commonCoreGenres(albums: PublishedAlbumSummary[]) {
  const counts = new Map<string, number>();
  for (const album of albums) for (const genre of album.coreGenres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || getTaxonomyLabel(a.key).localeCompare(getTaxonomyLabel(b.key), "zh-CN"))
    .slice(0, 6);
}

function labelFor(kind: TopicKind, key: string) {
  if (kind === "scene") return getListeningSceneLabel(key);
  if (kind === "decade") return key.replace("s", " 年代");
  return getTaxonomyLabel(key);
}

function makeTopic(kind: TopicKind, key: string): TopicSummary {
  const albums = topicAlbums(kind, key);
  return {
    kind,
    key,
    slug: key,
    label: labelFor(kind, key),
    count: albums.length,
    previewAlbums: albums.slice(0, 4),
    commonCoreGenres: commonCoreGenres(albums),
  };
}

export function getTopicSummaries(kind: TopicKind) {
  const options = buildDiscoverOptions();
  const keys = kind === "core"
    ? catalogTaxonomy.filter((item) => item.kind === "core" && options.coreGenres.includes(item.key)).map((item) => item.key)
    : kind === "related"
      ? options.relatedGenres
      : kind === "scene"
        ? options.contexts
        : options.decades;
  return keys.map((key) => makeTopic(kind, key)).filter((topic) => topic.count > 0);
}

export function getTopic(kind: TopicKind, slug: string) {
  return getTopicSummaries(kind).find((topic) => topic.slug === slug) ?? null;
}

export function getTopicAlbums(kind: TopicKind, key: string) {
  return topicAlbums(kind, key);
}

export function filterTopicAlbums(
  albums: PublishedAlbumSummary[],
  filters: { decade?: string | null; releaseType?: ReleaseType | null; coreGenre?: string | null },
  sort: CatalogSort,
) {
  return discoverAlbums(filters, sort, albums);
}

export function deterministicTopicAlbum(albums: PublishedAlbumSummary[], seed: string) {
  if (!albums.length) return null;
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return albums[Math.abs(hash >>> 0) % albums.length];
}
