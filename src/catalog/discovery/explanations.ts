import type { DiscoveryTransitionFamily } from "./path-context";
import type {
  AlbumRelationEvidence,
  DiscoveryIndex,
  DiscoveryNodeType,
  DiscoveryRelationType,
} from "./types";

export const DISCOVERY_EXPLANATION_KEYS = [
  "discovery.secondary.shared",
  "discovery.artist.later",
  "discovery.artist.earlier",
  "discovery.artist.shared_credit",
  "discovery.primary.adjacent_era",
  "discovery.primary.different_era",
  "discovery.primary.same_era",
  "discovery.context.genre_bridge",
  "discovery.context.era_bridge",
  "discovery.era.same",
  "discovery.era.adjacent",
] as const;

export type DiscoveryExplanationKey = (typeof DISCOVERY_EXPLANATION_KEYS)[number];

export const DISCOVERY_ENTRY_EXPLANATION_KEYS = [
  "discovery.artist.escape",
  "discovery.topic.to_album",
] as const;

export type DiscoveryEntryExplanationKey = (typeof DISCOVERY_ENTRY_EXPLANATION_KEYS)[number];

export interface ArtistEscapeExplanation {
  readonly key: "discovery.artist.escape";
  readonly evidence: Readonly<{
    sourceArtistId: string;
    anchorAlbumId: string;
    targetAlbumId: string;
    targetArtistIds: readonly string[];
    supportingRelation: DiscoveryRelationType;
  }>;
  readonly supportingExplanation: DiscoveryExplanation;
}

export type TopicDiscoveryNodeType = Extract<
  DiscoveryNodeType,
  "PRIMARY_GENRE" | "SECONDARY_GENRE" | "ERA" | "LISTENING_CONTEXT"
>;

export interface TopicEntryExplanation {
  readonly key: "discovery.topic.to_album";
  readonly evidence: Readonly<{
    topicType: TopicDiscoveryNodeType;
    topicKey: string;
    targetAlbumId: string;
  }>;
}

export type DiscoveryEntryExplanation = ArtistEscapeExplanation | TopicEntryExplanation;

export interface DiscoveryExplanation {
  readonly key: DiscoveryExplanationKey;
  readonly relation: DiscoveryRelationType;
  readonly transitionFamily: DiscoveryTransitionFamily;
  readonly evidence: Readonly<Record<string, string | number | readonly string[]>>;
  readonly contrast?: Readonly<Record<string, string | number | readonly string[]>>;
}

function frozenRecord(values: Record<string, string | number | readonly string[]>) {
  return Object.freeze(values);
}

function factsFor(index: DiscoveryIndex, evidence: AlbumRelationEvidence) {
  const source = index.albumFactsById.get(evidence.sourceAlbumId);
  const target = index.albumFactsById.get(evidence.targetAlbumId);
  return source && target ? { source, target } : null;
}

export function buildDiscoveryExplanation(
  index: DiscoveryIndex,
  relationEvidence: AlbumRelationEvidence,
  transitionFamily: DiscoveryTransitionFamily,
): DiscoveryExplanation | null {
  const facts = factsFor(index, relationEvidence);
  if (!facts) return null;
  const { source, target } = facts;
  const sameArtist = relationEvidence.relations.find((relation) => relation.type === "SAME_ARTIST");
  const primary = relationEvidence.relations.find((relation) => relation.type === "SAME_PRIMARY_GENRE");
  const secondary = relationEvidence.relations.find((relation) => relation.type === "SHARED_SECONDARY_GENRE");
  const sameEra = relationEvidence.relations.find((relation) => relation.type === "SAME_ERA");
  const adjacentEra = relationEvidence.relations.find((relation) => relation.type === "ADJACENT_ERA");
  const chronology = relationEvidence.relations.find((relation) => relation.type === "CHRONOLOGICAL_NEIGHBOR");
  const context = relationEvidence.relations.find((relation) => relation.type === "SHARED_LISTENING_CONTEXT");

  if (transitionFamily === "SHARED_SECONDARY" && secondary?.secondaryGenres.length) {
    return Object.freeze({
      key: "discovery.secondary.shared",
      relation: "SHARED_SECONDARY_GENRE",
      transitionFamily,
      evidence: frozenRecord({ secondaryGenres: secondary.secondaryGenres }),
      ...(source.era !== target.era && source.era && target.era
        ? { contrast: frozenRecord({ sourceEra: source.era, targetEra: target.era }) }
        : {}),
    });
  }

  if (transitionFamily === "CLEAN_CHRONOLOGY" && chronology?.neighbors.length && sameArtist?.artistIds.length) {
    const neighbor = chronology.neighbors[0];
    if (source.releaseYear == null || target.releaseYear == null || source.releaseYear === target.releaseYear) return null;
    return Object.freeze({
      key: target.releaseYear > source.releaseYear ? "discovery.artist.later" : "discovery.artist.earlier",
      relation: "CHRONOLOGICAL_NEIGHBOR",
      transitionFamily,
      evidence: frozenRecord({
        artistIds: sameArtist.artistIds,
        sourceYear: source.releaseYear,
        targetYear: target.releaseYear,
        direction: neighbor.direction,
        orderingBasis: neighbor.orderingBasis,
      }),
    });
  }

  if (transitionFamily === "SHARED_ARTIST" && sameArtist?.artistIds.length) {
    return Object.freeze({
      key: "discovery.artist.shared_credit",
      relation: "SAME_ARTIST",
      transitionFamily,
      evidence: frozenRecord({
        artistIds: sameArtist.artistIds,
        sourceCreditCount: sameArtist.sourceCreditCount,
        targetCreditCount: sameArtist.targetCreditCount,
      }),
    });
  }

  if (transitionFamily === "PRIMARY_ADJACENT_ERA" && primary?.primaryGenres.length && adjacentEra) {
    return Object.freeze({
      key: "discovery.primary.adjacent_era",
      relation: "SAME_PRIMARY_GENRE",
      transitionFamily,
      evidence: frozenRecord({
        primaryGenres: primary.primaryGenres,
        sourceEra: adjacentEra.sourceEra,
        targetEra: adjacentEra.targetEra,
        sourceYear: adjacentEra.sourceYear,
        targetYear: adjacentEra.targetYear,
      }),
    });
  }

  if (transitionFamily === "PRIMARY_DIFFERENT_ERA" && primary?.primaryGenres.length && source.era && target.era && source.era !== target.era) {
    return Object.freeze({
      key: "discovery.primary.different_era",
      relation: "SAME_PRIMARY_GENRE",
      transitionFamily,
      evidence: frozenRecord({
        primaryGenres: primary.primaryGenres,
        sourceEra: source.era,
        targetEra: target.era,
        sourceYear: source.releaseYear ?? source.era,
        targetYear: target.releaseYear ?? target.era,
      }),
      ...(context?.listeningContexts.length
        ? { contrast: frozenRecord({ sharedListeningContexts: context.listeningContexts }) }
        : {}),
    });
  }

  if ((transitionFamily === "PRIMARY_SAME_ERA_CONTEXT" || transitionFamily === "PRIMARY_SAME_ERA") && primary?.primaryGenres.length && sameEra) {
    return Object.freeze({
      key: "discovery.primary.same_era",
      relation: "SAME_PRIMARY_GENRE",
      transitionFamily,
      evidence: frozenRecord({
        primaryGenres: primary.primaryGenres,
        era: sameEra.era,
        sourceYear: sameEra.sourceYear,
        targetYear: sameEra.targetYear,
        ...(transitionFamily === "PRIMARY_SAME_ERA_CONTEXT" && context?.listeningContexts.length
          ? { sharedListeningContexts: context.listeningContexts }
          : {}),
      }),
    });
  }

  if (transitionFamily === "PRIMARY_ONLY" && primary?.primaryGenres.length && source.era && target.era && source.era !== target.era) {
    return Object.freeze({
      key: "discovery.primary.different_era",
      relation: "SAME_PRIMARY_GENRE",
      transitionFamily,
      evidence: frozenRecord({
        primaryGenres: primary.primaryGenres,
        sourceEra: source.era,
        targetEra: target.era,
        sourceYear: source.releaseYear ?? source.era,
        targetYear: target.releaseYear ?? target.era,
      }),
    });
  }

  if (transitionFamily === "CONTEXT_GENRE_BRIDGE" && context?.listeningContexts.length) {
    const sourceGenres = source.primaryGenres;
    const targetGenres = target.primaryGenres;
    if (!sourceGenres.length || !targetGenres.length || sourceGenres.some((genre) => targetGenres.includes(genre))) return null;
    return Object.freeze({
      key: "discovery.context.genre_bridge",
      relation: "SHARED_LISTENING_CONTEXT",
      transitionFamily,
      evidence: frozenRecord({
        listeningContexts: context.listeningContexts,
        sourcePrimaryGenres: sourceGenres,
        targetPrimaryGenres: targetGenres,
      }),
      ...(source.era && target.era && source.era !== target.era
        ? { contrast: frozenRecord({ sourceEra: source.era, targetEra: target.era }) }
        : {}),
    });
  }

  if ((transitionFamily === "CONTEXT_ADJACENT_ERA" || transitionFamily === "CONTEXT_SAME_ERA") && context?.listeningContexts.length) {
    const sourceEra = adjacentEra?.sourceEra ?? sameEra?.era;
    const targetEra = adjacentEra?.targetEra ?? sameEra?.era;
    if (!sourceEra || !targetEra) return null;
    return Object.freeze({
      key: "discovery.context.era_bridge",
      relation: "SHARED_LISTENING_CONTEXT",
      transitionFamily,
      evidence: frozenRecord({
        listeningContexts: context.listeningContexts,
        sourceEra,
        targetEra,
        sourceYear: source.releaseYear ?? sourceEra,
        targetYear: target.releaseYear ?? targetEra,
      }),
      ...(source.primaryGenres.length && target.primaryGenres.length
        ? { contrast: frozenRecord({
            sourcePrimaryGenres: source.primaryGenres,
            targetPrimaryGenres: target.primaryGenres,
          }) }
        : {}),
    });
  }

  if (transitionFamily === "ERA_ADJACENT" && adjacentEra) {
    return Object.freeze({
      key: "discovery.era.adjacent",
      relation: "ADJACENT_ERA",
      transitionFamily,
      evidence: frozenRecord({
        sourceEra: adjacentEra.sourceEra,
        targetEra: adjacentEra.targetEra,
        sourceYear: adjacentEra.sourceYear,
        targetYear: adjacentEra.targetYear,
      }),
    });
  }

  if (transitionFamily === "ERA_SAME" && sameEra) {
    return Object.freeze({
      key: "discovery.era.same",
      relation: "SAME_ERA",
      transitionFamily,
      evidence: frozenRecord({
        era: sameEra.era,
        sourceYear: sameEra.sourceYear,
        targetYear: sameEra.targetYear,
        targetPrimaryGenres: target.primaryGenres,
      }),
    });
  }

  return null;
}

export function validateDiscoveryExplanation(
  index: DiscoveryIndex,
  relationEvidence: AlbumRelationEvidence,
  explanation: DiscoveryExplanation,
) {
  const rebuilt = buildDiscoveryExplanation(index, relationEvidence, explanation.transitionFamily);
  return rebuilt != null && JSON.stringify(rebuilt) === JSON.stringify(explanation);
}

export function buildArtistEscapeExplanation(
  index: DiscoveryIndex,
  sourceArtistId: string,
  relationEvidence: AlbumRelationEvidence,
  supportingExplanation: DiscoveryExplanation,
): ArtistEscapeExplanation | null {
  const source = index.albumFactsById.get(relationEvidence.sourceAlbumId);
  const target = index.albumFactsById.get(relationEvidence.targetAlbumId);
  if (!source?.artistIds.includes(sourceArtistId) || !target || target.artistIds.includes(sourceArtistId)) {
    return null;
  }
  if (!validateDiscoveryExplanation(index, relationEvidence, supportingExplanation)) return null;
  return Object.freeze({
    key: "discovery.artist.escape",
    evidence: Object.freeze({
      sourceArtistId,
      anchorAlbumId: source.albumId,
      targetAlbumId: target.albumId,
      targetArtistIds: Object.freeze([...target.artistIds]),
      supportingRelation: supportingExplanation.relation,
    }),
    supportingExplanation,
  });
}

export function validateArtistEscapeExplanation(
  index: DiscoveryIndex,
  relationEvidence: AlbumRelationEvidence,
  explanation: ArtistEscapeExplanation,
) {
  const rebuilt = buildArtistEscapeExplanation(
    index,
    explanation.evidence.sourceArtistId,
    relationEvidence,
    explanation.supportingExplanation,
  );
  return rebuilt != null && JSON.stringify(rebuilt) === JSON.stringify(explanation);
}

function topicMembershipMatches(
  index: DiscoveryIndex,
  topicType: TopicDiscoveryNodeType,
  topicKey: string,
  targetAlbumId: string,
) {
  const facts = index.albumFactsById.get(targetAlbumId);
  if (!facts) return false;
  if (topicType === "PRIMARY_GENRE") return facts.primaryGenres.includes(topicKey);
  if (topicType === "SECONDARY_GENRE") return facts.secondaryGenres.includes(topicKey);
  if (topicType === "ERA") return facts.era === topicKey;
  return facts.listeningContexts.includes(topicKey);
}

export function buildTopicEntryExplanation(
  index: DiscoveryIndex,
  topicType: TopicDiscoveryNodeType,
  topicKey: string,
  targetAlbumId: string,
): TopicEntryExplanation | null {
  const node = index.nodes.find((candidate) =>
    candidate.type === topicType && candidate.canonicalId === topicKey);
  if (!node || !topicMembershipMatches(index, topicType, topicKey, targetAlbumId)) return null;
  return Object.freeze({
    key: "discovery.topic.to_album",
    evidence: Object.freeze({ topicType, topicKey, targetAlbumId }),
  });
}

export function validateTopicEntryExplanation(
  index: DiscoveryIndex,
  explanation: TopicEntryExplanation,
) {
  const rebuilt = buildTopicEntryExplanation(
    index,
    explanation.evidence.topicType,
    explanation.evidence.topicKey,
    explanation.evidence.targetAlbumId,
  );
  return rebuilt != null && JSON.stringify(rebuilt) === JSON.stringify(explanation);
}
