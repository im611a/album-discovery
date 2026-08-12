import type { PublishedAlbumSummary } from "../schema";

export const PERSONAL_EVIDENCE_FAMILIES = [
  "LIKED_ALBUM_BRIDGE",
  "FAVORITE_ALBUM_BRIDGE",
  "SEED_ALBUM_BRIDGE",
  "TASTE_GENRE",
  "TASTE_CONTEXT",
  "TASTE_ERA",
  "SAVED_ALBUM_BRIDGE",
  "MARKED_LISTENED_BRIDGE",
  "RECENT_VIEW_BRIDGE",
] as const;

export type PersonalEvidenceFamily = (typeof PERSONAL_EVIDENCE_FAMILIES)[number];
export type PersonalizationContext = "HOME" | "FOR_YOU" | "ALBUM" | "ARTIST" | "EXPLORE";
export type PersonalizationProvenance = "PERSONAL" | "RELATION_FALLBACK";
export type PersonalRankingTier =
  | "EXPLICIT_AFFINITY"
  | "PROFILE_MATCH"
  | "SAVED_OR_MARKED_LISTENED"
  | "RECENT_VIEW"
  | "RELATION_FALLBACK";

export interface NormalizedTasteState {
  readonly genres: readonly string[];
  readonly contexts: readonly string[];
  readonly eras: readonly string[];
  readonly seedAlbumIds: readonly string[];
  readonly exploration: "familiar" | "balanced" | "exploratory";
}

export interface NormalizedPersonalState {
  readonly taste: NormalizedTasteState;
  readonly likedAlbumIds: readonly string[];
  readonly favoriteAlbumIds: readonly string[];
  readonly savedAlbumIds: readonly string[];
  readonly listenedAlbumIds: readonly string[];
  readonly dismissedAlbumIds: readonly string[];
  readonly recentAlbumIds: readonly string[];
  readonly onboardingCompleted: boolean;
}

export interface PersonalizationPathContext {
  readonly visitedAlbumIds: readonly string[];
  readonly step: number;
}

export interface PersonalEvidence {
  readonly family: PersonalEvidenceFamily;
  readonly sourceAlbumId: string | null;
  readonly sourceValue: string | null;
  readonly matchedValue: string;
}

export interface PersonalExplanation {
  readonly key: `personal.${Lowercase<PersonalEvidenceFamily>}` | "relation.fallback";
  readonly evidence: PersonalEvidence | null;
}

export interface PersonalCandidate {
  readonly album: PublishedAlbumSummary;
  readonly provenance: PersonalizationProvenance;
  readonly tier: PersonalRankingTier;
  readonly evidence: readonly PersonalEvidence[];
  readonly explanations: readonly PersonalExplanation[];
  readonly diversityRelaxed: boolean;
}

export interface PersonalizationResult {
  readonly version: 1;
  readonly context: PersonalizationContext;
  readonly candidates: readonly PersonalCandidate[];
  readonly normalizedState: NormalizedPersonalState;
  readonly path: PersonalizationPathContext;
  readonly excludedAlbumIds: readonly string[];
}

export interface RankPersonalAlbumsInput {
  readonly state: unknown;
  readonly catalog: readonly PublishedAlbumSummary[];
  readonly context: PersonalizationContext;
  readonly limit?: number;
  readonly path?: unknown;
  readonly relationFallbackAlbumIds?: readonly string[];
  readonly eligibleAlbumIds?: readonly string[];
  readonly excludedAlbumIds?: readonly string[];
}
