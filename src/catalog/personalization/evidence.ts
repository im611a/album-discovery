import type { PublishedAlbumSummary } from "../schema";
import type { NormalizedPersonalState, PersonalEvidence, PersonalEvidenceFamily, PersonalRankingTier } from "./types";

const eraFor = (album: PublishedAlbumSummary) => album.releaseYear == null ? null : `${Math.floor(album.releaseYear / 10) * 10}s`;
const overlap = (left: readonly string[], right: readonly string[]) => left.filter((value) => right.includes(value)).sort();
const evidenceKey = (item: PersonalEvidence) => `${item.family}|${item.sourceAlbumId ?? ""}|${item.sourceValue ?? ""}|${item.matchedValue}`;

function bridges(
  family: PersonalEvidenceFamily,
  sourceIds: readonly string[],
  target: PublishedAlbumSummary,
  albumById: ReadonlyMap<string, PublishedAlbumSummary>,
) {
  const output: PersonalEvidence[] = [];
  for (const sourceId of sourceIds) {
    const source = albumById.get(sourceId);
    if (!source || source.id === target.id) continue;
    for (const value of overlap(source.coreGenres, target.coreGenres).slice(0, 2)) output.push({ family, sourceAlbumId: sourceId, sourceValue: value, matchedValue: value });
    for (const value of overlap(source.contexts, target.contexts).slice(0, 1)) output.push({ family, sourceAlbumId: sourceId, sourceValue: value, matchedValue: value });
    if (!output.some((item) => item.sourceAlbumId === sourceId)) {
      const sourceEra = eraFor(source);
      if (sourceEra && sourceEra === eraFor(target)) output.push({ family, sourceAlbumId: sourceId, sourceValue: sourceEra, matchedValue: sourceEra });
    }
  }
  return output;
}

export function extractPersonalEvidence(
  state: NormalizedPersonalState,
  target: PublishedAlbumSummary,
  albumById: ReadonlyMap<string, PublishedAlbumSummary>,
) {
  const evidence: PersonalEvidence[] = [];
  for (const value of overlap(state.taste.genres, target.coreGenres)) evidence.push({ family: "TASTE_GENRE", sourceAlbumId: null, sourceValue: value, matchedValue: value });
  for (const value of overlap(state.taste.contexts, target.contexts)) evidence.push({ family: "TASTE_CONTEXT", sourceAlbumId: null, sourceValue: value, matchedValue: value });
  const era = eraFor(target);
  if (era && state.taste.eras.includes(era)) evidence.push({ family: "TASTE_ERA", sourceAlbumId: null, sourceValue: era, matchedValue: era });
  evidence.push(...bridges("LIKED_ALBUM_BRIDGE", state.likedAlbumIds, target, albumById));
  evidence.push(...bridges("FAVORITE_ALBUM_BRIDGE", state.favoriteAlbumIds, target, albumById));
  evidence.push(...bridges("SEED_ALBUM_BRIDGE", state.taste.seedAlbumIds, target, albumById));
  evidence.push(...bridges("SAVED_ALBUM_BRIDGE", state.savedAlbumIds, target, albumById));
  evidence.push(...bridges("MARKED_LISTENED_BRIDGE", state.listenedAlbumIds, target, albumById));
  evidence.push(...bridges("RECENT_VIEW_BRIDGE", state.recentAlbumIds, target, albumById));
  return Object.freeze([...new Map(evidence.map((item) => [evidenceKey(item), Object.freeze(item)])).values()]);
}

export function rankingTier(evidence: readonly PersonalEvidence[]): PersonalRankingTier | null {
  const families = new Set(evidence.map((item) => item.family));
  if (["LIKED_ALBUM_BRIDGE", "FAVORITE_ALBUM_BRIDGE", "SEED_ALBUM_BRIDGE"].some((item) => families.has(item as PersonalEvidenceFamily))) return "EXPLICIT_AFFINITY";
  if (["TASTE_GENRE", "TASTE_CONTEXT", "TASTE_ERA"].some((item) => families.has(item as PersonalEvidenceFamily))) return "PROFILE_MATCH";
  if (["SAVED_ALBUM_BRIDGE", "MARKED_LISTENED_BRIDGE"].some((item) => families.has(item as PersonalEvidenceFamily))) return "SAVED_OR_MARKED_LISTENED";
  if (families.has("RECENT_VIEW_BRIDGE")) return "RECENT_VIEW";
  return null;
}

export function albumEra(album: PublishedAlbumSummary) {
  return eraFor(album) ?? "unknown";
}
