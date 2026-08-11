import {
  buildArtistEscapeExplanation,
  buildDiscoveryExplanation,
  type ArtistEscapeExplanation,
  type DiscoveryExplanation,
} from "./explanations";
import {
  appendDiscoveryPathContext,
  EMPTY_DISCOVERY_PATH_CONTEXT,
  parseDiscoveryPathContext,
  serializeDiscoveryPathContext,
  type DiscoveryPathContext,
  type DiscoveryTransitionFamily,
} from "./path-context";
import {
  areAdjacentEras,
  compareCanonicalValues,
  getAlbumRelationEvidence,
} from "./relation-index";
import type {
  AlbumRelationEvidence,
  DiscoveryAlbumFacts,
  DiscoveryIndex,
  DiscoveryRelationType,
} from "./types";

export const DISCOVERY_RANK_TIERS = ["SPECIFIC", "COMPOUND", "LOCAL", "FALLBACK"] as const;
export type DiscoveryRankTier = (typeof DISCOVERY_RANK_TIERS)[number];

export type EvidenceFrequencyBand = "RARE" | "FOCUSED" | "BROAD";

export interface DiscoveryRankKey {
  readonly tier: DiscoveryRankTier;
  readonly entryLensMismatch: 0 | 1;
  readonly relationOrder: number;
  readonly creditAmbiguity: 0 | 1;
  readonly frequencyBand: EvidenceFrequencyBand;
  readonly evidenceFieldCount: number;
  readonly chronologyProximity: number;
  readonly stableAlbumId: string;
}

export interface DiscoveryCandidate {
  readonly sourceAlbumId: string;
  readonly targetAlbumId: string;
  readonly targetSlug: string;
  readonly primaryRelation: DiscoveryRelationType;
  readonly transitionFamily: DiscoveryTransitionFamily;
  readonly relations: AlbumRelationEvidence["relations"];
  readonly rankKey: DiscoveryRankKey;
  readonly explanation: DiscoveryExplanation;
  readonly nextPathContext: DiscoveryPathContext;
}

export interface DiscoveryResult {
  readonly status: "FOUND" | "EMPTY";
  readonly sourceAlbumId: string;
  readonly sourceSlug: string;
  readonly pathContext: DiscoveryPathContext;
  readonly candidatePoolSize: number;
  readonly primary: DiscoveryCandidate | null;
  readonly alternates: readonly DiscoveryCandidate[];
  readonly options: readonly DiscoveryCandidate[];
}

export interface DiscoveryNotFoundResult {
  readonly status: "NOT_FOUND";
  readonly sourceAlbumId: string;
}

export type DiscoverFromAlbumResult = DiscoveryResult | DiscoveryNotFoundResult;

export interface DiscoverFromArtistResult {
  readonly status: "FOUND" | "NOT_FOUND";
  readonly artistId: string;
  readonly artistAlbumIds: readonly string[];
  readonly anchorAlbumId: string | null;
  readonly discovery: DiscoverFromAlbumResult | null;
  readonly sourceArtist: Readonly<{ id: string; slug: string }> | null;
  readonly sourceWorks: readonly Readonly<{
    albumId: string;
    releaseDate: string | null;
    releaseYear: number | null;
  }>[];
  readonly artistShape: "MULTI_WORK" | "SINGLE_WORK" | null;
  readonly primaryTarget: Readonly<{
    albumId: string;
    slug: string;
    artistIds: readonly string[];
  }> | null;
  readonly primaryTargetType: "ALBUM" | null;
  readonly primaryRelation: DiscoveryRelationType | null;
  readonly primaryEvidence: AlbumRelationEvidence | null;
  readonly primaryExplanationKey: DiscoveryExplanation["key"] | ArtistEscapeExplanation["key"] | null;
  readonly primaryExplanation: DiscoveryExplanation | ArtistEscapeExplanation | null;
  readonly alternates: readonly DiscoveryCandidate[];
  readonly pathContext: DiscoveryPathContext;
  readonly chronologyContext: Readonly<{
    anchorIndex: number;
    previousAlbumId: string | null;
    nextAlbumId: string | null;
  }> | null;
  readonly escapeReason: "CHRONOLOGY" | "MULTI_WORK_RELATION" | "SINGLE_WORK_CROSS_ARTIST" | "BOUNDED_PATH_CROSS_ARTIST" | "NO_TARGET";
}

interface ClassifiedCandidate {
  readonly transitionFamily: DiscoveryTransitionFamily;
  readonly tier: DiscoveryRankTier;
  readonly relationOrder: number;
  readonly primaryRelation: DiscoveryRelationType;
}

const TIER_ORDER = new Map(DISCOVERY_RANK_TIERS.map((tier, index) => [tier, index] as const));
const FREQUENCY_ORDER: Record<EvidenceFrequencyBand, number> = { RARE: 0, FOCUSED: 1, BROAD: 2 };

function relationOf<T extends DiscoveryRelationType>(evidence: AlbumRelationEvidence, type: T) {
  return evidence.relations.find((relation) => relation.type === type) as
    Extract<AlbumRelationEvidence["relations"][number], { type: T }> | undefined;
}

function classifyCandidate(
  evidence: AlbumRelationEvidence,
  pathContext: DiscoveryPathContext,
): ClassifiedCandidate | null {
  const secondary = relationOf(evidence, "SHARED_SECONDARY_GENRE");
  const sameArtist = relationOf(evidence, "SAME_ARTIST");
  const primary = relationOf(evidence, "SAME_PRIMARY_GENRE");
  const sameEra = relationOf(evidence, "SAME_ERA");
  const adjacentEra = relationOf(evidence, "ADJACENT_ERA");
  const chronology = relationOf(evidence, "CHRONOLOGICAL_NEIGHBOR");
  const context = relationOf(evidence, "SHARED_LISTENING_CONTEXT");
  const cleanChronology = chronology?.neighbors.length && sameArtist
    && sameArtist.sourceCreditCount === 1 && sameArtist.targetCreditCount === 1
    && chronology.neighbors.every((neighbor) => neighbor.sourceYear != null && neighbor.targetYear != null
      && neighbor.sourceYear !== neighbor.targetYear);

  if (secondary?.secondaryGenres.length) {
    return { transitionFamily: "SHARED_SECONDARY", tier: "SPECIFIC", relationOrder: 0, primaryRelation: "SHARED_SECONDARY_GENRE" };
  }
  if (cleanChronology) {
    return { transitionFamily: "CLEAN_CHRONOLOGY", tier: "SPECIFIC", relationOrder: 1, primaryRelation: "CHRONOLOGICAL_NEIGHBOR" };
  }
  if (primary?.primaryGenres.length && adjacentEra) {
    return { transitionFamily: "PRIMARY_ADJACENT_ERA", tier: "COMPOUND", relationOrder: 0, primaryRelation: "SAME_PRIMARY_GENRE" };
  }
  if (primary?.primaryGenres.length && context?.listeningContexts.length && !sameEra && !adjacentEra) {
    return { transitionFamily: "PRIMARY_DIFFERENT_ERA", tier: "COMPOUND", relationOrder: 1, primaryRelation: "SAME_PRIMARY_GENRE" };
  }
  if (primary?.primaryGenres.length && sameEra && context?.listeningContexts.length) {
    return { transitionFamily: "PRIMARY_SAME_ERA_CONTEXT", tier: "COMPOUND", relationOrder: 2, primaryRelation: "SAME_PRIMARY_GENRE" };
  }
  if (primary?.primaryGenres.length && sameEra) {
    return { transitionFamily: "PRIMARY_SAME_ERA", tier: "LOCAL", relationOrder: 0, primaryRelation: "SAME_PRIMARY_GENRE" };
  }
  if (sameArtist?.artistIds.length) {
    return { transitionFamily: "SHARED_ARTIST", tier: "LOCAL", relationOrder: 1, primaryRelation: "SAME_ARTIST" };
  }
  if (primary?.primaryGenres.length) {
    return { transitionFamily: "PRIMARY_ONLY", tier: "LOCAL", relationOrder: 2, primaryRelation: "SAME_PRIMARY_GENRE" };
  }
  if (adjacentEra && context?.listeningContexts.length) {
    return { transitionFamily: "CONTEXT_ADJACENT_ERA", tier: "FALLBACK", relationOrder: 0, primaryRelation: "SHARED_LISTENING_CONTEXT" };
  }
  if (sameEra && context?.listeningContexts.length) {
    return { transitionFamily: "CONTEXT_SAME_ERA", tier: "FALLBACK", relationOrder: 1, primaryRelation: "SHARED_LISTENING_CONTEXT" };
  }
  if (context?.listeningContexts.length) {
    return { transitionFamily: "CONTEXT_GENRE_BRIDGE", tier: "FALLBACK", relationOrder: 2, primaryRelation: "SHARED_LISTENING_CONTEXT" };
  }
  if (pathContext.entryKind === "era" && adjacentEra) {
    return { transitionFamily: "ERA_ADJACENT", tier: "FALLBACK", relationOrder: 3, primaryRelation: "ADJACENT_ERA" };
  }
  if (pathContext.entryKind === "era" && sameEra) {
    return { transitionFamily: "ERA_SAME", tier: "FALLBACK", relationOrder: 4, primaryRelation: "SAME_ERA" };
  }
  return null;
}

function candidateIds(index: DiscoveryIndex, source: DiscoveryAlbumFacts) {
  const values = new Set<string>();
  const include = (albumIds: readonly string[] | undefined) => albumIds?.forEach((albumId) => values.add(albumId));
  source.artistIds.forEach((artistId) => include(index.albumIdsByArtistId.get(artistId)));
  source.primaryGenres.forEach((genre) => include(index.albumIdsByPrimaryGenre.get(genre)));
  source.secondaryGenres.forEach((genre) => include(index.albumIdsBySecondaryGenre.get(genre)));
  if (source.era) {
    include(index.albumIdsByEra.get(source.era));
    for (const [era, albumIds] of index.albumIdsByEra) {
      if (areAdjacentEras(source.era, era)) include(albumIds);
    }
  }
  source.listeningContexts.forEach((context) => include(index.albumIdsByListeningContext.get(context)));
  values.delete(source.albumId);
  return [...values].sort(compareCanonicalValues);
}

function frequencyBand(count: number): EvidenceFrequencyBand {
  if (count <= 4) return "RARE";
  if (count <= 16) return "FOCUSED";
  return "BROAD";
}

function evidenceFrequency(index: DiscoveryIndex, evidence: AlbumRelationEvidence, family: DiscoveryTransitionFamily) {
  const sizes: number[] = [];
  const add = (size: number | undefined) => { if (size != null) sizes.push(size); };
  const secondary = relationOf(evidence, "SHARED_SECONDARY_GENRE");
  const artist = relationOf(evidence, "SAME_ARTIST");
  const primary = relationOf(evidence, "SAME_PRIMARY_GENRE");
  const sameEra = relationOf(evidence, "SAME_ERA");
  const adjacentEra = relationOf(evidence, "ADJACENT_ERA");
  const context = relationOf(evidence, "SHARED_LISTENING_CONTEXT");
  if (family === "SHARED_SECONDARY") secondary?.secondaryGenres.forEach((value) => add(index.albumIdsBySecondaryGenre.get(value)?.length));
  else if (family === "CLEAN_CHRONOLOGY" || family === "SHARED_ARTIST") artist?.artistIds.forEach((value) => add(index.albumIdsByArtistId.get(value)?.length));
  else if (family.startsWith("PRIMARY")) primary?.primaryGenres.forEach((value) => add(index.albumIdsByPrimaryGenre.get(value)?.length));
  else if (family.startsWith("CONTEXT")) context?.listeningContexts.forEach((value) => add(index.albumIdsByListeningContext.get(value)?.length));
  else if (family === "ERA_SAME" && sameEra) add(index.albumIdsByEra.get(sameEra.era)?.length);
  else if (family === "ERA_ADJACENT" && adjacentEra) add(index.albumIdsByEra.get(adjacentEra.targetEra)?.length);
  return Math.min(...(sizes.length ? sizes : [Number.MAX_SAFE_INTEGER]));
}

function entryLensMatches(
  index: DiscoveryIndex,
  evidence: AlbumRelationEvidence,
  context: DiscoveryPathContext,
) {
  if (!context.entryKind) return false;
  const key = context.entryKey;
  if (context.entryKind === "artist" && key) {
    const artistNode = index.nodes.find((node) => node.type === "ARTIST" && (node.slug === key || node.canonicalId === key));
    return artistNode != null && Boolean(relationOf(evidence, "SAME_ARTIST")?.artistIds.includes(artistNode.canonicalId));
  }
  if (context.entryKind === "primary-genre" && key) return Boolean(relationOf(evidence, "SAME_PRIMARY_GENRE")?.primaryGenres.includes(key));
  if (context.entryKind === "secondary-genre" && key) return Boolean(relationOf(evidence, "SHARED_SECONDARY_GENRE")?.secondaryGenres.includes(key));
  if (context.entryKind === "listening-context" && key) return Boolean(relationOf(evidence, "SHARED_LISTENING_CONTEXT")?.listeningContexts.includes(key));
  if (context.entryKind === "era" && key) {
    const same = relationOf(evidence, "SAME_ERA");
    const adjacent = relationOf(evidence, "ADJACENT_ERA");
    return same?.era === key || adjacent?.sourceEra === key || adjacent?.targetEra === key;
  }
  return false;
}

export function compareDiscoveryRankKeys(left: DiscoveryRankKey, right: DiscoveryRankKey) {
  return (TIER_ORDER.get(left.tier) ?? 0) - (TIER_ORDER.get(right.tier) ?? 0)
    || left.entryLensMismatch - right.entryLensMismatch
    || left.relationOrder - right.relationOrder
    || left.creditAmbiguity - right.creditAmbiguity
    || FREQUENCY_ORDER[left.frequencyBand] - FREQUENCY_ORDER[right.frequencyBand]
    || right.evidenceFieldCount - left.evidenceFieldCount
    || left.chronologyProximity - right.chronologyProximity
    || compareCanonicalValues(left.stableAlbumId, right.stableAlbumId);
}

function compareRank(left: DiscoveryCandidate, right: DiscoveryCandidate) {
  return compareDiscoveryRankKeys(left.rankKey, right.rankKey);
}

function isArtistFamily(family: DiscoveryTransitionFamily) {
  return family === "CLEAN_CHRONOLOGY" || family === "SHARED_ARTIST";
}

function isPrimaryFamily(family: DiscoveryTransitionFamily) {
  return family.startsWith("PRIMARY");
}

function isSameEraFamily(family: DiscoveryTransitionFamily) {
  return family === "PRIMARY_SAME_ERA_CONTEXT" || family === "PRIMARY_SAME_ERA"
    || family === "CONTEXT_SAME_ERA" || family === "ERA_SAME";
}

function recentRun(context: DiscoveryPathContext, predicate: (family: DiscoveryTransitionFamily) => boolean) {
  let count = 0;
  for (let index = context.transitionFamilies.length - 1; index >= 0; index -= 1) {
    if (!predicate(context.transitionFamilies[index])) break;
    count += 1;
  }
  return count;
}

function applyTrailFilters(
  candidates: readonly DiscoveryCandidate[],
  index: DiscoveryIndex,
  context: DiscoveryPathContext,
) {
  const albumIdBySlug = new Map([...index.albumFactsById.values()].map((facts) => [facts.slug, facts.albumId] as const));
  const immediatePreviousId = context.trailAlbumSlugs.length
    ? albumIdBySlug.get(context.trailAlbumSlugs.at(-1) ?? "")
    : undefined;
  const withoutImmediate = candidates.filter((candidate) => candidate.targetAlbumId !== immediatePreviousId);
  const excluded = new Set(context.trailAlbumSlugs.map((slug) => albumIdBySlug.get(slug)).filter((id): id is string => id != null));
  let eligible = withoutImmediate.filter((candidate) => !excluded.has(candidate.targetAlbumId));
  if (eligible.length || !withoutImmediate.length) return eligible;
  for (const slug of context.trailAlbumSlugs) {
    const id = albumIdBySlug.get(slug);
    if (id && id !== immediatePreviousId) excluded.delete(id);
    eligible = withoutImmediate.filter((candidate) => !excluded.has(candidate.targetAlbumId));
    if (eligible.length) return eligible;
  }
  return withoutImmediate;
}

function choosePrimary(
  candidates: readonly DiscoveryCandidate[],
  index: DiscoveryIndex,
  source: DiscoveryAlbumFacts,
  context: DiscoveryPathContext,
) {
  let preferred = [...candidates];
  const prefer = (predicate: (candidate: DiscoveryCandidate) => boolean) => {
    const matching = preferred.filter(predicate);
    if (matching.length) preferred = matching;
  };
  if (recentRun(context, isArtistFamily) >= 1) prefer((candidate) => !isArtistFamily(candidate.transitionFamily));
  if (recentRun(context, isPrimaryFamily) >= 2) prefer((candidate) => !isPrimaryFamily(candidate.transitionFamily));
  if (recentRun(context, isSameEraFamily) >= 2) {
    prefer((candidate) => index.albumFactsById.get(candidate.targetAlbumId)?.era !== source.era);
  }
  return preferred[0] ?? null;
}

function chooseAlternates(
  candidates: readonly DiscoveryCandidate[],
  primary: DiscoveryCandidate,
  index: DiscoveryIndex,
  context: DiscoveryPathContext,
) {
  let pool = candidates.filter((candidate) => candidate.targetAlbumId !== primary.targetAlbumId);
  if (recentRun(context, isArtistFamily) >= 2) pool = pool.filter((candidate) => !isArtistFamily(candidate.transitionFamily));
  const selected: DiscoveryCandidate[] = [];
  const usedFamilies = new Set<DiscoveryTransitionFamily>([primary.transitionFamily]);
  const usedArtistIds = new Set(index.albumFactsById.get(primary.targetAlbumId)?.artistIds ?? []);
  const canUse = (candidate: DiscoveryCandidate) => {
    const artistIds = index.albumFactsById.get(candidate.targetAlbumId)?.artistIds ?? [];
    return !artistIds.some((artistId) => usedArtistIds.has(artistId));
  };
  const add = (candidate: DiscoveryCandidate) => {
    selected.push(candidate);
    usedFamilies.add(candidate.transitionFamily);
    index.albumFactsById.get(candidate.targetAlbumId)?.artistIds.forEach((artistId) => usedArtistIds.add(artistId));
  };
  for (const candidate of pool) {
    if (selected.length >= 3) break;
    if (!usedFamilies.has(candidate.transitionFamily) && canUse(candidate)) add(candidate);
  }
  for (const candidate of pool) {
    if (selected.length >= 3) break;
    if (!selected.includes(candidate) && canUse(candidate)) add(candidate);
  }
  return Object.freeze(selected);
}

function normalizedContext(index: DiscoveryIndex, context: DiscoveryPathContext | undefined) {
  if (!context) return EMPTY_DISCOVERY_PATH_CONTEXT;
  return parseDiscoveryPathContext(serializeDiscoveryPathContext(context), index);
}

function rankedCandidates(
  index: DiscoveryIndex,
  source: DiscoveryAlbumFacts,
  pathContext: DiscoveryPathContext,
) {
  return candidateIds(index, source).flatMap((targetAlbumId) => {
    const target = index.albumFactsById.get(targetAlbumId);
    const evidence = getAlbumRelationEvidence(index, source.albumId, targetAlbumId);
    if (!target || !evidence) return [];
    const classified = classifyCandidate(evidence, pathContext);
    if (!classified) return [];
    const explanation = buildDiscoveryExplanation(index, evidence, classified.transitionFamily);
    if (!explanation) return [];
    const sameArtist = relationOf(evidence, "SAME_ARTIST");
    const proximity = pathContext.entryKind === "artist" && source.releaseYear != null && target.releaseYear != null
      ? Math.abs(source.releaseYear - target.releaseYear)
      : 0;
    const rankKey: DiscoveryRankKey = Object.freeze({
      tier: classified.tier,
      entryLensMismatch: entryLensMatches(index, evidence, pathContext) ? 0 : 1,
      relationOrder: classified.relationOrder,
      creditAmbiguity: sameArtist && (sameArtist.sourceCreditCount > 1 || sameArtist.targetCreditCount > 1) ? 1 : 0,
      frequencyBand: frequencyBand(evidenceFrequency(index, evidence, classified.transitionFamily)),
      evidenceFieldCount: evidence.relations.length,
      chronologyProximity: proximity,
      stableAlbumId: targetAlbumId,
    });
    const candidate: DiscoveryCandidate = Object.freeze({
      sourceAlbumId: source.albumId,
      targetAlbumId,
      targetSlug: target.slug,
      primaryRelation: classified.primaryRelation,
      transitionFamily: classified.transitionFamily,
      relations: evidence.relations,
      rankKey,
      explanation,
      nextPathContext: appendDiscoveryPathContext(pathContext, source.slug, classified.transitionFamily),
    });
    return [candidate];
  }).sort(compareRank);
}

function foundDiscoveryResult(
  index: DiscoveryIndex,
  source: DiscoveryAlbumFacts,
  pathContext: DiscoveryPathContext,
  candidates: readonly DiscoveryCandidate[],
  forcedPrimary?: DiscoveryCandidate,
): DiscoveryResult {
  const eligible = applyTrailFilters(candidates, index, pathContext);
  if (!eligible.length) {
    return Object.freeze({
      status: "EMPTY",
      sourceAlbumId: source.albumId,
      sourceSlug: source.slug,
      pathContext,
      candidatePoolSize: candidates.length,
      primary: null,
      alternates: Object.freeze([]),
      options: Object.freeze([]),
    });
  }
  const primary = forcedPrimary && eligible.includes(forcedPrimary)
    ? forcedPrimary
    : choosePrimary(eligible, index, source, pathContext);
  if (!primary) throw new Error(`Discovery candidate selection failed for ${source.albumId}.`);
  const alternates = chooseAlternates(eligible, primary, index, pathContext);
  return Object.freeze({
    status: "FOUND",
    sourceAlbumId: source.albumId,
    sourceSlug: source.slug,
    pathContext,
    candidatePoolSize: candidates.length,
    primary,
    alternates,
    options: Object.freeze([primary, ...alternates]),
  });
}

export function discoverFromAlbum(
  index: DiscoveryIndex,
  sourceAlbumId: string,
  context?: DiscoveryPathContext,
): DiscoverFromAlbumResult {
  const source = index.albumFactsById.get(sourceAlbumId);
  if (!source) return Object.freeze({ status: "NOT_FOUND", sourceAlbumId });
  const pathContext = normalizedContext(index, context);
  return foundDiscoveryResult(index, source, pathContext, rankedCandidates(index, source, pathContext));
}

export function discoverFromArtist(
  index: DiscoveryIndex,
  artistId: string,
  options: { readonly anchorAlbumId?: string; readonly pathContext?: DiscoveryPathContext } = {},
): DiscoverFromArtistResult {
  const chronology = index.chronologyByArtistId.get(artistId);
  if (!chronology?.length) {
    return Object.freeze({
      status: "NOT_FOUND",
      artistId,
      artistAlbumIds: Object.freeze([]),
      anchorAlbumId: null,
      discovery: null,
      sourceArtist: null,
      sourceWorks: Object.freeze([]),
      artistShape: null,
      primaryTarget: null,
      primaryTargetType: null,
      primaryRelation: null,
      primaryEvidence: null,
      primaryExplanationKey: null,
      primaryExplanation: null,
      alternates: Object.freeze([]),
      pathContext: EMPTY_DISCOVERY_PATH_CONTEXT,
      chronologyContext: null,
      escapeReason: "NO_TARGET",
    });
  }
  const albumIds = Object.freeze(chronology.map((entry) => entry.albumId));
  const requestedAnchor = options.anchorAlbumId && albumIds.includes(options.anchorAlbumId)
    ? options.anchorAlbumId
    : albumIds.at(-1) ?? null;
  if (!requestedAnchor) {
    return Object.freeze({
      status: "NOT_FOUND",
      artistId,
      artistAlbumIds: albumIds,
      anchorAlbumId: null,
      discovery: null,
      sourceArtist: null,
      sourceWorks: chronology,
      artistShape: null,
      primaryTarget: null,
      primaryTargetType: null,
      primaryRelation: null,
      primaryEvidence: null,
      primaryExplanationKey: null,
      primaryExplanation: null,
      alternates: Object.freeze([]),
      pathContext: EMPTY_DISCOVERY_PATH_CONTEXT,
      chronologyContext: null,
      escapeReason: "NO_TARGET",
    });
  }
  const artistNode = index.nodes.find((node) => node.type === "ARTIST" && node.canonicalId === artistId);
  const providedContext = normalizedContext(index, options.pathContext);
  const pathContext = providedContext.entryKind ? providedContext : Object.freeze({
    entryKind: "artist" as const,
    entryKey: artistNode && artistNode.type === "ARTIST" ? artistNode.slug : artistId,
    trailAlbumSlugs: providedContext.trailAlbumSlugs,
    transitionFamilies: providedContext.transitionFamilies,
  });
  const anchorFacts = index.albumFactsById.get(requestedAnchor);
  if (!anchorFacts) throw new Error(`Missing artist anchor facts for ${requestedAnchor}.`);
  const candidates = rankedCandidates(index, anchorFacts, pathContext);
  const artistCandidates = chronology.length > 1
    ? applyTrailFilters(candidates, index, pathContext).filter((candidate) =>
      index.albumFactsById.get(candidate.targetAlbumId)?.artistIds.includes(artistId))
    : [];
  const artistPrimary = recentRun(pathContext, isArtistFamily) === 0
    ? artistCandidates.find((candidate) => candidate.transitionFamily === "CLEAN_CHRONOLOGY")
      ?? artistCandidates[0]
    : undefined;
  const discovery = foundDiscoveryResult(index, anchorFacts, pathContext, candidates, artistPrimary);
  const primary = discovery.status === "FOUND" ? discovery.primary : null;
  const primaryFacts = primary ? index.albumFactsById.get(primary.targetAlbumId) : null;
  const primaryEvidence = primary ? Object.freeze({
    sourceAlbumId: primary.sourceAlbumId,
    targetAlbumId: primary.targetAlbumId,
    relations: primary.relations,
  }) : null;
  const crossesArtist = primaryFacts != null && !primaryFacts.artistIds.includes(artistId);
  const primaryExplanation = primary && primaryEvidence
    ? crossesArtist
      ? buildArtistEscapeExplanation(index, artistId, primaryEvidence, primary.explanation)
      : primary.explanation
    : null;
  const anchorIndex = chronology.findIndex((entry) => entry.albumId === requestedAnchor);
  const artistShape = chronology.length > 1 ? "MULTI_WORK" as const : "SINGLE_WORK" as const;
  return Object.freeze({
    status: "FOUND",
    artistId,
    artistAlbumIds: albumIds,
    anchorAlbumId: requestedAnchor,
    discovery,
    sourceArtist: artistNode && artistNode.type === "ARTIST"
      ? Object.freeze({ id: artistId, slug: artistNode.slug })
      : Object.freeze({ id: artistId, slug: artistId }),
    sourceWorks: chronology,
    artistShape,
    primaryTarget: primary && primaryFacts ? Object.freeze({
      albumId: primary.targetAlbumId,
      slug: primary.targetSlug,
      artistIds: primaryFacts.artistIds,
    }) : null,
    primaryTargetType: primary ? "ALBUM" : null,
    primaryRelation: primary?.primaryRelation ?? null,
    primaryEvidence,
    primaryExplanationKey: primaryExplanation?.key ?? null,
    primaryExplanation,
    alternates: discovery.status === "FOUND" ? discovery.alternates : Object.freeze([]),
    pathContext,
    chronologyContext: Object.freeze({
      anchorIndex,
      previousAlbumId: chronology[anchorIndex - 1]?.albumId ?? null,
      nextAlbumId: chronology[anchorIndex + 1]?.albumId ?? null,
    }),
    escapeReason: !primary
      ? "NO_TARGET"
      : crossesArtist
        ? artistShape === "SINGLE_WORK"
          ? "SINGLE_WORK_CROSS_ARTIST"
          : "BOUNDED_PATH_CROSS_ARTIST"
        : primary.transitionFamily === "CLEAN_CHRONOLOGY"
          ? "CHRONOLOGY"
          : "MULTI_WORK_RELATION",
  });
}
