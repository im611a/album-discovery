import { seededIndex } from "../exploration";
import type { PublishedAlbumSummary } from "../schema";
import { discoverFromAlbum } from "./candidate-engine";
import { validateDiscoveryExplanation } from "./explanations";
import { buildExploreEntry, type ExploreRelationSource } from "./explore-entry";
import { parseDiscoveryPathContext } from "./path-context";
import { getAlbumRelationEvidence } from "./relation-index";
import type { DiscoveryIndex } from "./types";

export interface DiscoverySimulationSummary {
  readonly seedCount: number;
  readonly stepsPerSeed: number;
  readonly requestedTransitions: number;
  readonly completedTransitions: number;
  readonly deadEnds: number;
  readonly forcedTruthRuleRelaxations: number;
  readonly immediateReversals: number;
  readonly avoidableShortLoops: number;
  readonly artistStreakMaximum: number;
  readonly primaryGenreStreakMaximum: number;
  readonly eraStreakMaximum: number;
  readonly revisits: number;
  readonly revisitRate: number;
  readonly uniqueAlbumsReached: number;
  readonly uniqueArtistsReached: number;
  readonly explanationFailures: number;
  readonly deterministicReplayFailures: number;
  readonly originTypeCounts: Readonly<Record<string, number>>;
}

export interface DiscoverySimulationReport {
  readonly summary: DiscoverySimulationSummary;
  readonly paths: readonly Readonly<{
    seed: number;
    origin: ExploreRelationSource;
    entryAlbumId: string | null;
    transitions: readonly Readonly<{
      step: number;
      sourceAlbumId: string;
      targetAlbumId: string;
      transitionFamily: string;
      explanationKey: string;
    }>[];
    stopped: "COMPLETE" | "DEAD_END";
  }>[];
}

function originPool(index: DiscoveryIndex, albums: readonly PublishedAlbumSummary[]) {
  return {
    ALBUM: albums.map((album) => album.id),
    ARTIST: [...index.albumIdsByArtistId.keys()],
    PRIMARY_GENRE: [...index.albumIdsByPrimaryGenre.keys()],
    SECONDARY_GENRE: [...index.albumIdsBySecondaryGenre.keys()],
    ERA: [...index.albumIdsByEra.keys()],
    LISTENING_CONTEXT: [...index.albumIdsByListeningContext.keys()],
  } as const;
}

const SIMULATION_ORIGIN_TYPES = [
  "ALBUM",
  "ARTIST",
  "PRIMARY_GENRE",
  "SECONDARY_GENRE",
  "ERA",
  "LISTENING_CONTEXT",
] as const;

function simulationOrigin(
  index: DiscoveryIndex,
  albums: readonly PublishedAlbumSummary[],
  seed: number,
): ExploreRelationSource {
  const pools = originPool(index, albums);
  const kind = SIMULATION_ORIGIN_TYPES[seed % SIMULATION_ORIGIN_TYPES.length];
  const values = pools[kind];
  const position = seededIndex(`r13-3f-origin-${kind}-${seed}`, values.length);
  return Object.freeze({ kind, key: values[position] });
}

function updatesStreak(family: string, predicate: (value: string) => boolean, current: number) {
  return predicate(family) ? current + 1 : 0;
}

export function simulateDiscoveryPaths(
  index: DiscoveryIndex,
  albums: readonly PublishedAlbumSummary[],
  { seedCount = 100, stepsPerSeed = 20 } = {},
): DiscoverySimulationReport {
  const paths: Array<DiscoverySimulationReport["paths"][number]> = [];
  const reachedAlbumIds = new Set<string>();
  let completedTransitions = 0;
  let deadEnds = 0;
  let forcedTruthRuleRelaxations = 0;
  let immediateReversals = 0;
  let avoidableShortLoops = 0;
  let revisits = 0;
  let explanationFailures = 0;
  let deterministicReplayFailures = 0;
  let artistStreakMaximum = 0;
  let primaryGenreStreakMaximum = 0;
  let eraStreakMaximum = 0;
  const originTypeCounts: Record<string, number> = {};

  for (let seed = 0; seed < seedCount; seed += 1) {
    const origin = simulationOrigin(index, albums, seed);
    originTypeCounts[origin.kind] = (originTypeCounts[origin.kind] ?? 0) + 1;
    const entry = buildExploreEntry(index, albums, { mode: "RELATION_ENTRY", source: origin });
    let currentAlbumId = entry.target?.albumId ?? null;
    let context = entry.target
      ? parseDiscoveryPathContext(new URL(entry.target.href, "https://local.test").searchParams, index)
      : entry.pathContext;
    const pathAlbumIds: string[] = currentAlbumId ? [currentAlbumId] : [];
    if (currentAlbumId) reachedAlbumIds.add(currentAlbumId);
    const transitions: Array<DiscoverySimulationReport["paths"][number]["transitions"][number]> = [];
    let artistStreak = 0;
    let primaryGenreStreak = 0;
    let eraStreak = 0;
    let stopped: "COMPLETE" | "DEAD_END" = "COMPLETE";

    for (let step = 0; step < stepsPerSeed; step += 1) {
      if (!currentAlbumId) {
        deadEnds += 1;
        stopped = "DEAD_END";
        break;
      }
      const result = discoverFromAlbum(index, currentAlbumId, context);
      const replay = discoverFromAlbum(index, currentAlbumId, context);
      if (JSON.stringify(result) !== JSON.stringify(replay)) deterministicReplayFailures += 1;
      if (result.status !== "FOUND" || !result.primary) {
        deadEnds += 1;
        stopped = "DEAD_END";
        break;
      }
      const primary = result.primary;
      const evidence = getAlbumRelationEvidence(index, currentAlbumId, primary.targetAlbumId);
      if (!evidence || !validateDiscoveryExplanation(index, evidence, primary.explanation)) {
        explanationFailures += 1;
      }
      const previousAlbumId = pathAlbumIds.at(-2);
      if (primary.targetAlbumId === previousAlbumId) immediateReversals += 1;
      const recent = new Set(pathAlbumIds.slice(-3));
      if (recent.has(primary.targetAlbumId)) {
        const truthfulAlternative = result.options.some((candidate) => !recent.has(candidate.targetAlbumId));
        if (truthfulAlternative) avoidableShortLoops += 1;
        else forcedTruthRuleRelaxations += 1;
      }
      if (pathAlbumIds.includes(primary.targetAlbumId)) revisits += 1;
      artistStreak = updatesStreak(primary.transitionFamily, (family) =>
        family === "CLEAN_CHRONOLOGY" || family === "SHARED_ARTIST", artistStreak);
      primaryGenreStreak = updatesStreak(primary.transitionFamily, (family) =>
        family.startsWith("PRIMARY"), primaryGenreStreak);
      eraStreak = updatesStreak(primary.transitionFamily, (family) =>
        family.includes("ERA"), eraStreak);
      artistStreakMaximum = Math.max(artistStreakMaximum, artistStreak);
      primaryGenreStreakMaximum = Math.max(primaryGenreStreakMaximum, primaryGenreStreak);
      eraStreakMaximum = Math.max(eraStreakMaximum, eraStreak);
      transitions.push(Object.freeze({
        step,
        sourceAlbumId: currentAlbumId,
        targetAlbumId: primary.targetAlbumId,
        transitionFamily: primary.transitionFamily,
        explanationKey: primary.explanation.key,
      }));
      completedTransitions += 1;
      currentAlbumId = primary.targetAlbumId;
      context = primary.nextPathContext;
      pathAlbumIds.push(currentAlbumId);
      reachedAlbumIds.add(currentAlbumId);
    }

    paths.push(Object.freeze({
      seed,
      origin,
      entryAlbumId: pathAlbumIds[0] ?? null,
      transitions: Object.freeze(transitions),
      stopped,
    }));
  }

  const reachedArtists = new Set([...reachedAlbumIds].flatMap((albumId) =>
    index.albumFactsById.get(albumId)?.artistIds ?? []));
  return Object.freeze({
    summary: Object.freeze({
      seedCount,
      stepsPerSeed,
      requestedTransitions: seedCount * stepsPerSeed,
      completedTransitions,
      deadEnds,
      forcedTruthRuleRelaxations,
      immediateReversals,
      avoidableShortLoops,
      artistStreakMaximum,
      primaryGenreStreakMaximum,
      eraStreakMaximum,
      revisits,
      revisitRate: completedTransitions ? revisits / completedTransitions : 0,
      uniqueAlbumsReached: reachedAlbumIds.size,
      uniqueArtistsReached: reachedArtists.size,
      explanationFailures,
      deterministicReplayFailures,
      originTypeCounts: Object.freeze(originTypeCounts),
    }),
    paths: Object.freeze(paths),
  });
}

export function auditDiscoveryReachability(
  index: DiscoveryIndex,
  albums: readonly PublishedAlbumSummary[],
) {
  const adjacency = new Map<string, Set<string>>(albums.map((album) => [album.id, new Set()]));
  const incoming = new Map<string, number>(albums.map((album) => [album.id, 0]));
  const poolSizes: Array<{ albumId: string; candidatePoolSize: number; selectedOptionCount: number }> = [];
  for (const album of albums) {
    const result = discoverFromAlbum(index, album.id);
    if (result.status !== "FOUND") {
      poolSizes.push({ albumId: album.id, candidatePoolSize: 0, selectedOptionCount: 0 });
      continue;
    }
    poolSizes.push({ albumId: album.id, candidatePoolSize: result.candidatePoolSize, selectedOptionCount: result.options.length });
    for (const candidate of result.options) {
      adjacency.get(album.id)?.add(candidate.targetAlbumId);
      adjacency.get(candidate.targetAlbumId)?.add(album.id);
      incoming.set(candidate.targetAlbumId, (incoming.get(candidate.targetAlbumId) ?? 0) + 1);
    }
  }

  const remaining = new Set(adjacency.keys());
  const weakComponents: string[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value as string;
    const queue = [first];
    const component: string[] = [];
    remaining.delete(first);
    while (queue.length) {
      const albumId = queue.shift()!;
      component.push(albumId);
      for (const neighbor of adjacency.get(albumId) ?? []) {
        if (!remaining.delete(neighbor)) continue;
        queue.push(neighbor);
      }
    }
    weakComponents.push(component.sort());
  }
  weakComponents.sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));

  const isolatedAlbums = albums.filter((album) =>
    (adjacency.get(album.id)?.size ?? 0) === 0).map((album) => album.id);
  const isolatedArtists = [...index.albumIdsByArtistId.entries()].filter(([, albumIds]) =>
    albumIds.every((albumId) => isolatedAlbums.includes(albumId))).map(([artistId]) => artistId);
  const membershipCategories = [
    ...[...index.albumIdsByPrimaryGenre].map(([key, albumIds]) => ({ type: "PRIMARY_GENRE", key, albumCount: albumIds.length })),
    ...[...index.albumIdsBySecondaryGenre].map(([key, albumIds]) => ({ type: "SECONDARY_GENRE", key, albumCount: albumIds.length })),
    ...[...index.albumIdsByEra].map(([key, albumIds]) => ({ type: "ERA", key, albumCount: albumIds.length })),
    ...[...index.albumIdsByListeningContext].map(([key, albumIds]) => ({ type: "LISTENING_CONTEXT", key, albumCount: albumIds.length })),
  ].sort((left, right) => right.albumCount - left.albumCount || left.type.localeCompare(right.type) || left.key.localeCompare(right.key));

  return Object.freeze({
    catalogAlbumCount: albums.length,
    isolatedAlbums: Object.freeze(isolatedAlbums),
    isolatedArtists: Object.freeze(isolatedArtists),
    weakComponentCount: weakComponents.length,
    weakComponents: Object.freeze(weakComponents.map((component) => Object.freeze(component))),
    albumsNeverSelected: Object.freeze([...incoming].filter(([, count]) => count === 0).map(([albumId]) => albumId).sort()),
    verySmallCandidatePools: Object.freeze(poolSizes.filter((entry) => entry.candidatePoolSize <= 4)),
    veryLargeCandidatePools: Object.freeze(poolSizes.filter((entry) => entry.candidatePoolSize >= 100)),
    candidatePoolStats: Object.freeze({
      minimum: Math.min(...poolSizes.map((entry) => entry.candidatePoolSize)),
      maximum: Math.max(...poolSizes.map((entry) => entry.candidatePoolSize)),
      average: poolSizes.reduce((total, entry) => total + entry.candidatePoolSize, 0) / poolSizes.length,
    }),
    overconnectedCategories: Object.freeze(membershipCategories.slice(0, 20)),
    classification: Object.freeze({
      isolatedEntities: "CATALOG_TRUTH_OR_MODEL_LIMITATION_REQUIRES_REVIEW",
      unselectedAlbums: "SELECTED_OPTION_GRAPH_LIMITATION_NOT_ENTITY_INVALIDITY",
      largePools: "CATALOG_TAXONOMY_BREADTH",
      rankingChangeApplied: false,
    }),
  });
}
