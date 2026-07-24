import { getListeningSceneLabel } from "./listening-scenes";
import { catalogAlbums, getTaxonomyLabel, publishedArtists } from "./published-catalog";
import type { PublishedAlbumSummary } from "./schema";

export const SIMILARITY_WEIGHTS = {
  sharedCoreGenre: 8,
  sharedRelatedGenre: 6,
  adjacentDecade: 3,
  sharedScene: 2,
  compatibleReleaseType: 1,
} as const;

export interface SimilarAlbumResult {
  album: PublishedAlbumSummary;
  score: number;
  reason: string;
  contributions: {
    coreGenres: string[];
    relatedGenres: string[];
    scenes: string[];
    adjacentDecade: boolean;
    compatibleReleaseType: boolean;
  };
}

const overlap = (left: string[], right: string[]) => left.filter((value) => right.includes(value));
export const albumDecade = (album: PublishedAlbumSummary) =>
  album.releaseYear == null ? null : `${Math.floor(album.releaseYear / 10) * 10}s`;

function scoreSimilarAlbum(source: PublishedAlbumSummary, album: PublishedAlbumSummary): SimilarAlbumResult | null {
  const coreGenres = overlap(source.coreGenres, album.coreGenres);
  const relatedGenres = overlap(source.relatedGenres, album.relatedGenres);
  const scenes = overlap(source.contexts, album.contexts);
  const sourceDecade = albumDecade(source);
  const targetDecade = albumDecade(album);
  const adjacentDecade = sourceDecade != null && targetDecade != null &&
    Math.abs(Number.parseInt(sourceDecade) - Number.parseInt(targetDecade)) <= 10;
  const compatibleReleaseType = source.albumType === album.albumType;
  const score = coreGenres.length * SIMILARITY_WEIGHTS.sharedCoreGenre +
    relatedGenres.length * SIMILARITY_WEIGHTS.sharedRelatedGenre +
    Number(adjacentDecade) * SIMILARITY_WEIGHTS.adjacentDecade +
    scenes.length * SIMILARITY_WEIGHTS.sharedScene +
    Number(compatibleReleaseType) * SIMILARITY_WEIGHTS.compatibleReleaseType;
  if (!coreGenres.length && !relatedGenres.length) return null;
  const reason = relatedGenres.length
    ? `共享相关流派：${getTaxonomyLabel(relatedGenres[0])}`
    : coreGenres.length
      ? `共享核心流派：${getTaxonomyLabel(coreGenres[0])}`
      : adjacentDecade
        ? `同属 ${targetDecade?.replace("s", " 年代")}的专辑`
        : `都适合${getListeningSceneLabel(scenes[0])}`;
  return { album, score, reason, contributions: { coreGenres, relatedGenres, scenes, adjacentDecade, compatibleReleaseType } };
}

export function getSimilarAlbums(
  source: PublishedAlbumSummary,
  {
    albums = catalogAlbums,
    dismissedAlbumIds = [],
    limit = 6,
  }: { albums?: PublishedAlbumSummary[]; dismissedAlbumIds?: string[]; limit?: number } = {},
) {
  const dismissed = new Set(dismissedAlbumIds);
  const sourceArtists = new Set(source.artists.map((artist) => artist.id));
  const candidates = albums
    .filter((album) => album.id !== source.id && !dismissed.has(album.id))
    .map((album) => scoreSimilarAlbum(source, album))
    .filter((item): item is SimilarAlbumResult => item != null)
    .sort((left, right) => right.score - left.score || left.album.slug.localeCompare(right.album.slug));
  const differentArtists = candidates.filter((item) => !item.album.artists.some((artist) => sourceArtists.has(artist.id)));
  const sameArtists = candidates.filter((item) => item.album.artists.some((artist) => sourceArtists.has(artist.id)));
  const pool = differentArtists.length >= Math.min(4, limit) ? differentArtists : [...differentArtists, ...sameArtists.slice(0, 1)];
  const output: SimilarAlbumResult[] = [];
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  for (const item of pool) {
    const artistId = item.album.artists[0]?.id ?? "unknown";
    const primaryGenre = item.album.coreGenres[0] ?? "unknown";
    if ((artistCounts.get(artistId) ?? 0) >= 1 || (genreCounts.get(primaryGenre) ?? 0) >= 3) continue;
    output.push(item);
    artistCounts.set(artistId, (artistCounts.get(artistId) ?? 0) + 1);
    genreCounts.set(primaryGenre, (genreCounts.get(primaryGenre) ?? 0) + 1);
    if (output.length >= limit) break;
  }
  return output;
}

export function seededIndex(seed: string, length: number) {
  if (length < 1) return -1;
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

export function getSeededRandomAlbum(seed: string, albums = catalogAlbums, dismissedAlbumIds: string[] = []) {
  const dismissed = new Set(dismissedAlbumIds);
  const candidates = albums.filter((album) => !dismissed.has(album.id)).sort((a, b) => a.id.localeCompare(b.id));
  const index = seededIndex(seed, candidates.length);
  return index < 0 ? null : candidates[index];
}

export function buildExploreOptions(albums = catalogAlbums) {
  const count = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return {
    coreGenres: count(albums.flatMap((album) => album.coreGenres)).map((value) => ({
      value,
      label: getTaxonomyLabel(value),
      count: albums.filter((album) => album.coreGenres.includes(value)).length,
    })),
    relatedGenres: count(albums.flatMap((album) => album.relatedGenres)).map((value) => ({
      value,
      label: getTaxonomyLabel(value),
      count: albums.filter((album) => album.relatedGenres.includes(value)).length,
    })),
    decades: count(albums.map(albumDecade).filter((value): value is string => value != null)).map((value) => ({
      value,
      label: value.replace("s", " 年代"),
      count: albums.filter((album) => albumDecade(album) === value).length,
    })),
    scenes: count(albums.flatMap((album) => album.contexts)).map((value) => ({
      value,
      label: getListeningSceneLabel(value),
      count: albums.filter((album) => album.contexts.includes(value)).length,
    })),
    artists: publishedArtists.filter((artist) => artist.albumCount > 0).map((artist) => ({
      value: artist.artistId,
      label: artist.name,
      count: artist.albumCount,
    })),
  };
}

export function getArtistRelayAlbums(artistId: string, albums = catalogAlbums, limit = 12) {
  const sourceAlbums = albums.filter((album) => album.artists.some((artist) => artist.id === artistId));
  const sourceGenres = new Set(sourceAlbums.flatMap((album) => album.coreGenres));
  return albums
    .filter((album) =>
      !album.artists.some((artist) => artist.id === artistId) &&
      album.coreGenres.some((genre) => sourceGenres.has(genre)))
    .sort((a, b) => {
      const overlapA = a.coreGenres.filter((genre) => sourceGenres.has(genre)).length;
      const overlapB = b.coreGenres.filter((genre) => sourceGenres.has(genre)).length;
      return overlapB - overlapA || a.slug.localeCompare(b.slug);
    })
    .filter((album, index, values) =>
      values.findIndex((candidate) => candidate.artists[0]?.id === album.artists[0]?.id) === index)
    .slice(0, limit);
}
