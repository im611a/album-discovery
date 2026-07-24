import type { LocalUserStateV1, TasteProfile } from "@/features/personal-state/schema";
import { catalogAlbums, getTaxonomyLabel } from "./published-catalog";
import { getListeningSceneLabel } from "./listening-scenes";
import type { PublishedAlbumSummary } from "./schema";

export const RECOMMENDATION_WEIGHTS = {
  coreGenre: 5,
  context: 3,
  favoriteSimilarity: 4,
  savedSimilarity: 1.5,
  negativeSimilarity: -3,
  coldStart: 1,
  era: 1.5,
  editorial: 1,
  exploration: 1.5,
  lessViewedEra: 1,
} as const;
export interface Recommendation { album: PublishedAlbumSummary; score: number; reasons: string[]; lane: "familiar" | "adjacent" }

const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value));
const eraFor = (album: PublishedAlbumSummary) => album.releaseDate ? `${Math.floor(Number(album.releaseDate.slice(0, 4)) / 10) * 10}s` : null;

function derivedTaste(state: LocalUserStateV1): TasteProfile {
  const positiveIds = new Set([...state.likedAlbumIds, ...state.favoriteAlbumIds, ...state.taste.seedAlbumIds, ...Object.entries(state.recommendationFeedback).filter(([, value]) => value === "like").map(([id]) => id)]);
  const seeds = catalogAlbums.filter((album) => positiveIds.has(album.id));
  return {
    ...state.taste,
    genres: [...new Set([...state.taste.genres, ...seeds.flatMap((album) => album.coreGenres)])],
    contexts: [...new Set([...state.taste.contexts, ...seeds.flatMap((album) => album.contexts)])],
  };
}

export function recommendAlbums(state: LocalUserStateV1, limit = 18): Recommendation[] {
  const taste = derivedTaste(state);
  const favoriteSeeds = catalogAlbums.filter((album) => [...state.likedAlbumIds, ...state.favoriteAlbumIds, ...taste.seedAlbumIds].includes(album.id));
  const savedSeeds = catalogAlbums.filter((album) => state.savedAlbumIds.includes(album.id));
  const negativeIds = new Set([...state.dismissedAlbumIds, ...Object.entries(state.recommendationFeedback).filter(([, value]) => value === "not_for_me").map(([id]) => id)]);
  const likedIds = Object.entries(state.recommendationFeedback).filter(([, value]) => value === "like").map(([id]) => id);
  const negativeSeeds = catalogAlbums.filter((album) => negativeIds.has(album.id));
  const recentlyViewedEras = new Set(catalogAlbums.filter((album) => state.recentAlbumIds.includes(album.id)).map(eraFor).filter(Boolean));
  const excluded = new Set([...taste.seedAlbumIds, ...state.likedAlbumIds, ...state.favoriteAlbumIds, ...likedIds, ...state.savedAlbumIds, ...state.listenedAlbumIds, ...negativeIds]);
  const scored = catalogAlbums.filter((album) => !excluded.has(album.id)).map((album) => {
    const genreMatches = overlap(album.coreGenres, taste.genres);
    const contextMatches = overlap(album.contexts, taste.contexts);
    const era = eraFor(album);
    const eraMatch = era && taste.eras.includes(era);
    const similarity = (seed: PublishedAlbumSummary) =>
      overlap(album.coreGenres, seed.coreGenres).length +
      overlap(album.contexts, seed.contexts).length;
    const favoriteSimilarity = favoriteSeeds.reduce((best, seed) => Math.max(best, similarity(seed)), 0);
    const savedSimilarity = savedSeeds.reduce((best, seed) => Math.max(best, similarity(seed)), 0);
    const negativeSimilarity = negativeSeeds.reduce((worst, seed) => Math.max(worst, similarity(seed)), 0);
    const isAdjacent = genreMatches.length === 0 && contextMatches.length > 0;
    const exploration = taste.exploration === "exploratory" && isAdjacent ? RECOMMENDATION_WEIGHTS.exploration : taste.exploration === "familiar" && genreMatches.length ? 0.5 : 0;
    const coldStart = state.onboardingCompleted ? 0 : RECOMMENDATION_WEIGHTS.coldStart;
    const lessViewedEra = era && recentlyViewedEras.size > 0 && !recentlyViewedEras.has(era) ? RECOMMENDATION_WEIGHTS.lessViewedEra : 0;
    const score = genreMatches.length * RECOMMENDATION_WEIGHTS.coreGenre +
      contextMatches.length * RECOMMENDATION_WEIGHTS.context +
      favoriteSimilarity * RECOMMENDATION_WEIGHTS.favoriteSimilarity +
      savedSimilarity * RECOMMENDATION_WEIGHTS.savedSimilarity +
      negativeSimilarity * RECOMMENDATION_WEIGHTS.negativeSimilarity +
      (eraMatch ? RECOMMENDATION_WEIGHTS.era : 0) +
      (album.editorial ? RECOMMENDATION_WEIGHTS.editorial : 0) +
      exploration +
      lessViewedEra +
      coldStart;
    const reasons = [];
    if (genreMatches.length) reasons.push(`与你选择的${genreMatches.slice(0, 2).map(getTaxonomyLabel).join("、")}方向重合。`);
    if (contextMatches.length) reasons.push(`适合${contextMatches.slice(0, 2).map(getListeningSceneLabel).join("、")}的完整聆听。`);
    if (favoriteSimilarity > 0) reasons.push("与已喜欢或收藏专辑的流派或聆听场景有明确重合。");
    else if (savedSimilarity > 0) reasons.push("与想听清单中的专辑保留了一部分共同信号。");
    if (!genreMatches.length && contextMatches.length) reasons.push("这是一次有控制的相邻类型拓展。");
    if (lessViewedEra) reasons.push("来自你近期较少浏览的年代。");
    if (!reasons.length && album.editorial) reasons.push(album.editorial.whyListenZh);
    if (!reasons.length && coldStart) reasons.push("在尚无偏好时提供一个不同类型的冷启动选择。");
    return { album, score, reasons: reasons.slice(0, 3), lane: isAdjacent ? "adjacent" as const : "familiar" as const };
  }).filter((item) => item.score > 0 || !state.onboardingCompleted).sort((a, b) => b.score - a.score || a.album.slug.localeCompare(b.album.slug));

  const output: Recommendation[] = [];
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const eraCounts = new Map<string, number>();
  for (const item of scored) {
    const artist = item.album.artists[0]?.id ?? "unknown";
    const genre = item.album.coreGenres[0] ?? "other";
    const era = eraFor(item.album) ?? "unknown";
    if ((artistCounts.get(artist) ?? 0) >= 1 || (genreCounts.get(genre) ?? 0) >= 3 || (eraCounts.get(era) ?? 0) >= 4) continue;
    output.push(item);
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
    if (output.length >= limit) break;
  }
  return output;
}
