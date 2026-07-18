import type { LocalUserStateV1, TasteProfile } from "@/features/personal-state/schema";
import { catalogAlbums } from "./published-catalog";
import type { PublishedAlbum } from "./schema";

export const RECOMMENDATION_WEIGHTS = { primaryGenre: 5, descriptor: 3, context: 3, favoriteSimilarity: 4, era: 1.5, editorial: 1, exploration: 1.5 } as const;
export interface Recommendation { album: PublishedAlbum; score: number; reasons: string[]; lane: "familiar" | "adjacent" }

const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value));
const eraFor = (album: PublishedAlbum) => album.releaseDate ? `${Math.floor(Number(album.releaseDate.value.slice(0, 4)) / 10) * 10}s` : null;

function derivedTaste(state: LocalUserStateV1): TasteProfile {
  const positiveIds = new Set([...state.favoriteAlbumIds, ...state.taste.seedAlbumIds, ...Object.entries(state.recommendationFeedback).filter(([, value]) => value === "like").map(([id]) => id)]);
  const seeds = catalogAlbums.filter((album) => positiveIds.has(album.id));
  return {
    ...state.taste,
    genres: [...new Set([...state.taste.genres, ...seeds.flatMap((album) => album.primaryGenres)])],
    descriptors: [...new Set([...state.taste.descriptors, ...seeds.flatMap((album) => album.descriptors)])],
    contexts: [...new Set([...state.taste.contexts, ...seeds.flatMap((album) => album.contexts)])],
  };
}

export function recommendAlbums(state: LocalUserStateV1, limit = 18): Recommendation[] {
  const taste = derivedTaste(state);
  const seeds = catalogAlbums.filter((album) => [...state.favoriteAlbumIds, ...taste.seedAlbumIds].includes(album.id));
  const excluded = new Set([...taste.seedAlbumIds, ...state.favoriteAlbumIds, ...state.listenedAlbumIds, ...state.dismissedAlbumIds, ...Object.entries(state.recommendationFeedback).filter(([, value]) => value === "not_for_me").map(([id]) => id)]);
  const scored = catalogAlbums.filter((album) => !excluded.has(album.id)).map((album) => {
    const genreMatches = overlap(album.primaryGenres, taste.genres);
    const descriptorMatches = overlap(album.descriptors, taste.descriptors);
    const contextMatches = overlap(album.contexts, taste.contexts);
    const era = eraFor(album);
    const eraMatch = era && taste.eras.includes(era);
    const favoriteSimilarity = seeds.reduce((best, seed) => Math.max(best, overlap(album.primaryGenres, seed.primaryGenres).length + overlap(album.descriptors, seed.descriptors).length), 0);
    const isAdjacent = genreMatches.length === 0 && (descriptorMatches.length > 0 || contextMatches.length > 0);
    const exploration = taste.exploration === "exploratory" && isAdjacent ? RECOMMENDATION_WEIGHTS.exploration : taste.exploration === "familiar" && genreMatches.length ? 0.5 : 0;
    const score = genreMatches.length * RECOMMENDATION_WEIGHTS.primaryGenre + descriptorMatches.length * RECOMMENDATION_WEIGHTS.descriptor + contextMatches.length * RECOMMENDATION_WEIGHTS.context + favoriteSimilarity * RECOMMENDATION_WEIGHTS.favoriteSimilarity + (eraMatch ? RECOMMENDATION_WEIGHTS.era : 0) + (album.editorial ? RECOMMENDATION_WEIGHTS.editorial : 0) + exploration;
    const reasons = [];
    if (genreMatches.length) reasons.push(`与你选择的${genreMatches.slice(0, 2).join("、")}方向重合。`);
    if (descriptorMatches.length) reasons.push(`保留你偏好的${descriptorMatches.slice(0, 2).join("、")}质感。`);
    if (contextMatches.length) reasons.push(`适合${contextMatches.slice(0, 2).join("、")}的完整聆听。`);
    if (!genreMatches.length && (descriptorMatches.length || contextMatches.length)) reasons.push("这是一次有控制的相邻类型拓展。 ");
    if (!reasons.length && album.editorial) reasons.push(album.editorial.whyListenZh);
    return { album, score, reasons: reasons.slice(0, 3), lane: isAdjacent ? "adjacent" as const : "familiar" as const };
  }).filter((item) => item.score > 0 || !state.onboardingCompleted).sort((a, b) => b.score - a.score || a.album.slug.localeCompare(b.album.slug));

  const output: Recommendation[] = [];
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  for (const item of scored) {
    const artist = item.album.artists[0]?.id ?? "unknown";
    const genre = item.album.primaryGenres[0] ?? "other";
    if ((artistCounts.get(artist) ?? 0) >= 1 || (genreCounts.get(genre) ?? 0) >= 3) continue;
    output.push(item);
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    if (output.length >= limit) break;
  }
  return output;
}
