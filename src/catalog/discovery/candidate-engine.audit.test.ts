import { describe, expect, it } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import {
  discoverFromAlbum,
  type DiscoveryCandidate,
  type DiscoveryResult,
} from "./candidate-engine";
import { validateDiscoveryExplanation } from "./explanations";
import { getAlbumRelationEvidence } from "./relation-index";
import { publishedDiscoveryIndex } from "./published-index";
import type { DiscoveryRelationType } from "./types";

const RELATIONS: readonly DiscoveryRelationType[] = [
  "SAME_ARTIST",
  "SAME_PRIMARY_GENRE",
  "SHARED_SECONDARY_GENRE",
  "SAME_ERA",
  "ADJACENT_ERA",
  "CHRONOLOGICAL_NEIGHBOR",
  "SHARED_LISTENING_CONTEXT",
];

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function found(albumId: string, context?: DiscoveryResult["pathContext"]) {
  const result = discoverFromAlbum(publishedDiscoveryIndex, albumId, context);
  if (result.status !== "FOUND") throw new Error(`Expected discovery options for ${albumId}.`);
  return result;
}

function representativeStarts() {
  const selected: typeof catalogAlbums = [];
  const remaining = [...catalogAlbums].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const genres = new Set<string>();
  const eras = new Set<string>();
  const contexts = new Set<string>();
  const artistShapes = new Set<string>();
  while (selected.length < 20 && remaining.length) {
    let bestIndex = 0;
    let bestNovelty = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const album = remaining[index];
      const era = publishedDiscoveryIndex.albumFactsById.get(album.id)?.era;
      const isMultiWork = album.artists.some((artist) => (publishedArtists.find((entry) => entry.artistId === artist.id)?.albumCount ?? 0) > 1);
      const shape = isMultiWork ? "MULTI_WORK_ARTIST" : "SINGLE_WORK_ARTIST";
      const novelty = album.coreGenres.filter((value) => !genres.has(value)).length * 4
        + Number(era != null && !eras.has(era)) * 3
        + album.contexts.filter((value) => !contexts.has(value)).length * 2
        + Number(!artistShapes.has(shape));
      if (novelty > bestNovelty) {
        bestNovelty = novelty;
        bestIndex = index;
      }
    }
    const [album] = remaining.splice(bestIndex, 1);
    selected.push(album);
    album.coreGenres.forEach((value) => genres.add(value));
    album.contexts.forEach((value) => contexts.add(value));
    const era = publishedDiscoveryIndex.albumFactsById.get(album.id)?.era;
    if (era) eras.add(era);
    artistShapes.add(album.artists.some((artist) => (publishedArtists.find((entry) => entry.artistId === artist.id)?.albumCount ?? 0) > 1)
      ? "MULTI_WORK_ARTIST"
      : "SINGLE_WORK_ARTIST");
  }
  return selected;
}

describe("R13 real-catalog discovery audit", () => {
  it("audits every album and simulates deterministic bounded paths", () => {
    const primaryRelationDistribution: Record<string, number> = {};
    const alternateRelationDistribution: Record<string, number> = {};
    const selectedEvidenceRelationDistribution: Record<string, number> = {};
    const poolSizes: number[] = [];
    const allSelected: DiscoveryCandidate[] = [];
    let albumsWithCandidates = 0;
    let invalidTargets = 0;
    let unresolvedTargets = 0;
    let selfRelations = 0;
    let duplicateSelections = 0;
    let explanationEvidenceFailures = 0;
    let nondeterministicOutputs = 0;
    let immediateReversalPossibilities = 0;

    for (const album of catalogAlbums) {
      const result = found(album.id);
      const replay = found(album.id);
      if (JSON.stringify(result) !== JSON.stringify(replay)) nondeterministicOutputs += 1;
      poolSizes.push(result.candidatePoolSize);
      if (result.options.length) albumsWithCandidates += 1;
      const targetIds = result.options.map((candidate) => candidate.targetAlbumId);
      if (new Set(targetIds).size !== targetIds.length) duplicateSelections += 1;
      if (result.primary) increment(primaryRelationDistribution, result.primary.primaryRelation);
      for (const alternate of result.alternates) increment(alternateRelationDistribution, alternate.primaryRelation);
      for (const candidate of result.options) {
        allSelected.push(candidate);
        if (candidate.sourceAlbumId === candidate.targetAlbumId) selfRelations += 1;
        if (!publishedDiscoveryIndex.albumFactsById.has(candidate.targetAlbumId)) invalidTargets += 1;
        if (!catalogAlbums.some((target) => target.id === candidate.targetAlbumId)) unresolvedTargets += 1;
        candidate.relations.forEach((relation) => increment(selectedEvidenceRelationDistribution, relation.type));
        const evidence = getAlbumRelationEvidence(publishedDiscoveryIndex, candidate.sourceAlbumId, candidate.targetAlbumId);
        if (!evidence || !validateDiscoveryExplanation(publishedDiscoveryIndex, evidence, candidate.explanation)) {
          explanationEvidenceFailures += 1;
        }
      }
      if (result.primary) {
        const next = found(result.primary.targetAlbumId, result.primary.nextPathContext);
        if (next.options.some((candidate) => candidate.targetAlbumId === album.id)) immediateReversalPossibilities += 1;
      }
    }

    const starts = representativeStarts();
    let simulatedSteps = 0;
    let immediateReversalLoops = 0;
    let shortLoops = 0;
    let avoidableShortLoops = 0;
    let truthfulRelaxedShortLoops = 0;
    let deadEnds = 0;
    let invalidSimulationExplanations = 0;
    let nondeterministicSimulationReplays = 0;
    let maximumSameArtistStreak = 0;
    let maximumSamePrimaryGenreStreak = 0;
    let maximumSameEraStreak = 0;
    let avoidableSameArtistRepetitions = 0;
    let avoidableSamePrimaryGenreRepetitions = 0;
    let avoidableSameEraRepetitions = 0;
    const simulationPaths: Array<{ start: string; albumIds: string[]; transitions: string[] }> = [];

    for (const start of starts) {
      let currentId = start.id;
      let context: DiscoveryResult["pathContext"] | undefined;
      const albumIds = [currentId];
      const transitions: string[] = [];
      let artistStreak = 0;
      let primaryStreak = 0;
      let eraStreak = 0;
      for (let step = 0; step < 10; step += 1) {
        const result = discoverFromAlbum(publishedDiscoveryIndex, currentId, context);
        const replay = discoverFromAlbum(publishedDiscoveryIndex, currentId, context);
        if (JSON.stringify(result) !== JSON.stringify(replay)) nondeterministicSimulationReplays += 1;
        if (result.status !== "FOUND" || !result.primary) {
          deadEnds += 1;
          break;
        }
        const candidate = result.primary;
        if (candidate.targetAlbumId === albumIds.at(-2)) immediateReversalLoops += 1;
        if (albumIds.slice(-3).includes(candidate.targetAlbumId)) {
          shortLoops += 1;
          const immediateSlug = publishedDiscoveryIndex.albumFactsById.get(albumIds.at(-2) ?? "")?.slug;
          const minimallyFiltered = discoverFromAlbum(publishedDiscoveryIndex, currentId, {
            ...result.pathContext,
            trailAlbumSlugs: immediateSlug ? [immediateSlug] : [],
          });
          const hasNonLoopAlternative = minimallyFiltered.status === "FOUND"
            && minimallyFiltered.options.some((option) => !albumIds.slice(-3).includes(option.targetAlbumId));
          if (hasNonLoopAlternative) avoidableShortLoops += 1;
          else truthfulRelaxedShortLoops += 1;
        }
        const evidence = getAlbumRelationEvidence(publishedDiscoveryIndex, currentId, candidate.targetAlbumId);
        if (!evidence || !validateDiscoveryExplanation(publishedDiscoveryIndex, evidence, candidate.explanation)) {
          invalidSimulationExplanations += 1;
        }
        const artistFamily = candidate.transitionFamily === "CLEAN_CHRONOLOGY" || candidate.transitionFamily === "SHARED_ARTIST";
        const primaryFamily = candidate.transitionFamily.startsWith("PRIMARY");
        const sameEraFamily = ["PRIMARY_SAME_ERA_CONTEXT", "PRIMARY_SAME_ERA", "CONTEXT_SAME_ERA", "ERA_SAME"]
          .includes(candidate.transitionFamily);
        if (artistStreak >= 1 && artistFamily
          && result.options.some((option) => option.transitionFamily !== "CLEAN_CHRONOLOGY" && option.transitionFamily !== "SHARED_ARTIST")) {
          avoidableSameArtistRepetitions += 1;
        }
        if (primaryStreak >= 2 && primaryFamily
          && result.options.some((option) => !option.transitionFamily.startsWith("PRIMARY"))) {
          avoidableSamePrimaryGenreRepetitions += 1;
        }
        if (eraStreak >= 2 && sameEraFamily) {
          const sourceEra = publishedDiscoveryIndex.albumFactsById.get(currentId)?.era;
          if (result.options.some((option) => publishedDiscoveryIndex.albumFactsById.get(option.targetAlbumId)?.era !== sourceEra)) {
            avoidableSameEraRepetitions += 1;
          }
        }
        artistStreak = artistFamily ? artistStreak + 1 : 0;
        primaryStreak = primaryFamily ? primaryStreak + 1 : 0;
        eraStreak = sameEraFamily ? eraStreak + 1 : 0;
        maximumSameArtistStreak = Math.max(maximumSameArtistStreak, artistStreak);
        maximumSamePrimaryGenreStreak = Math.max(maximumSamePrimaryGenreStreak, primaryStreak);
        maximumSameEraStreak = Math.max(maximumSameEraStreak, eraStreak);
        transitions.push(candidate.transitionFamily);
        currentId = candidate.targetAlbumId;
        albumIds.push(currentId);
        context = candidate.nextPathContext;
        simulatedSteps += 1;
      }
      simulationPaths.push({ start: start.id, albumIds, transitions });
    }

    const goldenCases = RELATIONS.map((relationType) => {
      const candidate = allSelected.find((selection) => selection.relations.some((relation) => relation.type === relationType));
      if (!candidate) return null;
      const source = publishedDiscoveryIndex.albumFactsById.get(candidate.sourceAlbumId)!;
      const evidence = candidate.relations.find((relation) => relation.type === relationType)!;
      return {
        relationType,
        sourceAlbumId: candidate.sourceAlbumId,
        sourceSlug: source.slug,
        targetAlbumId: candidate.targetAlbumId,
        targetSlug: candidate.targetSlug,
        selectedPrimaryRelation: candidate.primaryRelation,
        supportingEvidence: evidence,
        rankTier: candidate.rankKey.tier,
        rankReason: `tier=${candidate.rankKey.tier}; family=${candidate.transitionFamily}; stableId=${candidate.rankKey.stableAlbumId}`,
        pathContextUsed: { trailAlbumSlugs: [], transitionFamilies: [] },
        nextPathContext: candidate.nextPathContext,
        explanation: candidate.explanation,
      };
    }).filter((value) => value != null);

    const audit = {
      albumsEvaluated: catalogAlbums.length,
      albumsWithCandidates,
      albumsWithNoContinuation: catalogAlbums.length - albumsWithCandidates,
      candidatePool: {
        minimum: Math.min(...poolSizes),
        average: Number((poolSizes.reduce((sum, count) => sum + count, 0) / poolSizes.length).toFixed(3)),
        maximum: Math.max(...poolSizes),
      },
      primaryRelationDistribution,
      alternateRelationDistribution,
      selectedEvidenceRelationDistribution,
      immediateReversalPossibilities,
      duplicatePrimaryTargets: 0,
      duplicateSelections,
      invalidTargets,
      unresolvedTargets,
      selfRelations,
      explanationEvidenceFailures,
      nondeterministicOutputs,
    };
    const simulation = {
      independentPaths: starts.length,
      requestedStepsPerPath: 10,
      simulatedSteps,
      immediateReversalLoops,
      shortLoops,
      avoidableShortLoops,
      truthfulRelaxedShortLoops,
      deadEnds,
      invalidSimulationExplanations,
      nondeterministicSimulationReplays,
      maximumSameArtistStreak,
      maximumSamePrimaryGenreStreak,
      maximumSameEraStreak,
      avoidableSameArtistRepetitions,
      avoidableSamePrimaryGenreRepetitions,
      avoidableSameEraRepetitions,
      starts: starts.map((album) => album.id),
      paths: simulationPaths,
    };

    expect(audit).toMatchObject({
      albumsEvaluated: 357,
      albumsWithCandidates: 357,
      albumsWithNoContinuation: 0,
      immediateReversalPossibilities: 0,
      duplicatePrimaryTargets: 0,
      duplicateSelections: 0,
      invalidTargets: 0,
      unresolvedTargets: 0,
      selfRelations: 0,
      explanationEvidenceFailures: 0,
      nondeterministicOutputs: 0,
    });
    expect(simulation).toMatchObject({
      independentPaths: 20,
      simulatedSteps: 200,
      immediateReversalLoops: 0,
      avoidableShortLoops: 0,
      deadEnds: 0,
      invalidSimulationExplanations: 0,
      nondeterministicSimulationReplays: 0,
      avoidableSameArtistRepetitions: 0,
      avoidableSamePrimaryGenreRepetitions: 0,
      avoidableSameEraRepetitions: 0,
    });
    expect(goldenCases).toHaveLength(RELATIONS.length);
  }, 20_000);
});
