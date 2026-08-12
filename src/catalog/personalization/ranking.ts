import { albumEra, extractPersonalEvidence, rankingTier } from "./evidence";
import { explanationForEvidence, relationFallbackExplanation } from "./explanations";
import { normalizePersonalizationPath, normalizePersonalState } from "./normalize";
import type { PersonalCandidate, PersonalRankingTier, PersonalizationResult, RankPersonalAlbumsInput } from "./types";

const TIER_ORDER: Record<PersonalRankingTier, number> = {
  EXPLICIT_AFFINITY: 0,
  PROFILE_MATCH: 1,
  SAVED_OR_MARKED_LISTENED: 2,
  RECENT_VIEW: 3,
  RELATION_FALLBACK: 4,
};

function compareCandidates(left: PersonalCandidate, right: PersonalCandidate) {
  const leftFamilies = new Set(left.evidence.map((item) => item.family)).size;
  const rightFamilies = new Set(right.evidence.map((item) => item.family)).size;
  const leftGenres = new Set(left.evidence.filter((item) => item.matchedValue && left.album.coreGenres.includes(item.matchedValue)).map((item) => item.matchedValue)).size;
  const rightGenres = new Set(right.evidence.filter((item) => item.matchedValue && right.album.coreGenres.includes(item.matchedValue)).map((item) => item.matchedValue)).size;
  const leftContexts = new Set(left.evidence.filter((item) => left.album.contexts.includes(item.matchedValue)).map((item) => item.matchedValue)).size;
  const rightContexts = new Set(right.evidence.filter((item) => right.album.contexts.includes(item.matchedValue)).map((item) => item.matchedValue)).size;
  return TIER_ORDER[left.tier] - TIER_ORDER[right.tier] ||
    rightFamilies - leftFamilies ||
    rightGenres - leftGenres ||
    rightContexts - leftContexts ||
    left.album.id.localeCompare(right.album.id);
}

function boundedSelection(ranked: readonly PersonalCandidate[], limit: number) {
  if (limit <= 0) return [];
  const output: PersonalCandidate[] = [];
  const skipped: PersonalCandidate[] = [];
  const artists = new Map<string, number>();
  const genres = new Map<string, number>();
  const eras = new Map<string, number>();
  for (const candidate of ranked) {
    const artist = candidate.album.artists[0]?.id ?? "unknown";
    const genre = candidate.album.coreGenres[0] ?? "unknown";
    const era = albumEra(candidate.album);
    if ((artists.get(artist) ?? 0) >= 1 || (genres.get(genre) ?? 0) >= 3 || (eras.get(era) ?? 0) >= 4) {
      skipped.push(candidate);
      continue;
    }
    output.push(candidate);
    artists.set(artist, (artists.get(artist) ?? 0) + 1);
    genres.set(genre, (genres.get(genre) ?? 0) + 1);
    eras.set(era, (eras.get(era) ?? 0) + 1);
    if (output.length === limit) return output;
  }
  for (const candidate of skipped) {
    if (output.length === limit) break;
    output.push(Object.freeze({ ...candidate, diversityRelaxed: true }));
  }
  return output;
}

export function rankPersonalAlbums(input: RankPersonalAlbumsInput): PersonalizationResult {
  const catalogIds = new Set(input.catalog.map((album) => album.id));
  const albumById = new Map(input.catalog.map((album) => [album.id, album] as const));
  const state = normalizePersonalState(input.state, catalogIds);
  const path = normalizePersonalizationPath(input.path, catalogIds);
  const eligible = input.eligibleAlbumIds ? new Set(input.eligibleAlbumIds.filter((id) => catalogIds.has(id))) : null;
  const excluded = new Set([
    ...state.taste.seedAlbumIds,
    ...state.likedAlbumIds,
    ...state.favoriteAlbumIds,
    ...state.savedAlbumIds,
    ...state.listenedAlbumIds,
    ...state.dismissedAlbumIds,
    ...path.visitedAlbumIds,
    ...(input.excludedAlbumIds ?? []).filter((id) => catalogIds.has(id)),
  ]);
  const ranked: PersonalCandidate[] = [];
  for (const album of input.catalog) {
    if (excluded.has(album.id) || (eligible && !eligible.has(album.id))) continue;
    const evidence = extractPersonalEvidence(state, album, albumById);
    const tier = rankingTier(evidence);
    if (!tier) continue;
    ranked.push(Object.freeze({
      album,
      provenance: "PERSONAL",
      tier,
      evidence,
      explanations: Object.freeze(evidence.slice(0, 3).map(explanationForEvidence)),
      diversityRelaxed: false,
    }));
  }
  const candidateIds = new Set(ranked.map((item) => item.album.id));
  for (const albumId of input.relationFallbackAlbumIds ?? []) {
    const album = albumById.get(albumId);
    if (!album || excluded.has(album.id) || candidateIds.has(album.id) || (eligible && !eligible.has(album.id))) continue;
    candidateIds.add(album.id);
    ranked.push(Object.freeze({
      album,
      provenance: "RELATION_FALLBACK",
      tier: "RELATION_FALLBACK",
      evidence: Object.freeze([]),
      explanations: Object.freeze([relationFallbackExplanation]),
      diversityRelaxed: false,
    }));
  }
  ranked.sort(compareCandidates);
  const limit = Math.max(0, Math.min(Number.isSafeInteger(input.limit) ? Number(input.limit) : 12, 50));
  return Object.freeze({
    version: 1,
    context: input.context,
    candidates: Object.freeze(boundedSelection(ranked, limit)),
    normalizedState: state,
    path,
    excludedAlbumIds: Object.freeze([...excluded].sort()),
  });
}
