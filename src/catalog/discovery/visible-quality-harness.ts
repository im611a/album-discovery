import { catalogAlbums, publishedArtists } from "../published-catalog";
import { getTopicSummaries, type TopicKind } from "../topics";
import {
  buildArtistDiscoveryPresentation,
  buildDiscoveryEntityHref,
  buildTopicDiscoveryPresentation,
  type ArtistDiscoveryPresentation,
  type TopicDiscoveryPresentation,
} from "./artist-topic-presentation";
import { discoverFromArtist } from "./candidate-engine";
import { validateDiscoveryExplanation } from "./explanations";
import { parseDiscoveryPathContext } from "./path-context";
import { buildAlbumDiscoveryPresentation } from "./presentation";
import { publishedDiscoveryIndex } from "./published-index";

const topicKinds: readonly TopicKind[] = ["core", "related", "decade", "scene"];
const albumById = new Map(catalogAlbums.map((album) => [album.id, album] as const));
const artistById = new Map(publishedArtists.map((artist) => [artist.artistId, artist] as const));

function hrefResolves(href: string, expectedSlug: string) {
  const url = new URL(href, "https://local.test");
  return url.pathname === `/albums/${expectedSlug}` || url.pathname === `/albums/${expectedSlug}/`;
}

function duplicateTargetCount(presentation: ArtistDiscoveryPresentation | TopicDiscoveryPresentation) {
  const ids = [presentation.primary.target.id, ...presentation.alternates.map((option) => option.target.id)];
  return ids.length - new Set(ids).size;
}

function topicTargetHasMembership(presentation: TopicDiscoveryPresentation) {
  const facts = publishedDiscoveryIndex.albumFactsById.get(presentation.primary.target.id);
  if (!facts) return false;
  if (presentation.source.kind === "core") return facts.primaryGenres.includes(presentation.source.key);
  if (presentation.source.kind === "related") return facts.secondaryGenres.includes(presentation.source.key);
  if (presentation.source.kind === "decade") return facts.era === presentation.source.key;
  return facts.listeningContexts.includes(presentation.source.key);
}

export function auditVisibleArtistTopicCatalog() {
  let validArtistContinuations = 0;
  let multiWorkPreservingChronology = 0;
  let singleWorkTruthfulEscapes = 0;
  let artistsWithoutContinuation = 0;
  let artistInvalidDestinations = 0;
  let artistUnresolvedDestinations = 0;
  let artistDuplicateDestinations = 0;
  let artistExplanationEvidenceFailures = 0;
  let artistDeterministicReplayFailures = 0;

  for (const artist of publishedArtists) {
    const presentation = buildArtistDiscoveryPresentation(artist.artistId);
    const replay = buildArtistDiscoveryPresentation(artist.artistId);
    if (JSON.stringify(presentation) !== JSON.stringify(replay)) artistDeterministicReplayFailures += 1;
    if (!presentation) {
      artistsWithoutContinuation += 1;
      continue;
    }
    const options = [presentation.primary, ...presentation.alternates];
    artistInvalidDestinations += options.filter((option) =>
      !publishedDiscoveryIndex.albumFactsById.has(option.target.id)).length;
    artistUnresolvedDestinations += options.filter((option) =>
      !hrefResolves(option.href, option.target.slug)).length;
    artistDuplicateDestinations += duplicateTargetCount(presentation);
    const engineResult = discoverFromArtist(publishedDiscoveryIndex, artist.artistId);
    const evidence = engineResult.primaryEvidence;
    const engineExplanation = engineResult.primaryExplanation;
    const explanationIsValid = Boolean(evidence && engineExplanation && (
      engineExplanation.key === "discovery.artist.escape"
        ? validateDiscoveryExplanation(publishedDiscoveryIndex, evidence, engineExplanation.supportingExplanation)
        : validateDiscoveryExplanation(publishedDiscoveryIndex, evidence, engineExplanation)
    ));
    if (!explanationIsValid || !presentation.primary.explanation || !presentation.primary.explanationKey) {
      artistExplanationEvidenceFailures += 1;
    }
    const primaryArtistIds = presentation.primary.target.artists.map((credit) => credit.id);
    if (artist.albumCount > 1 && primaryArtistIds.includes(artist.artistId)) {
      multiWorkPreservingChronology += 1;
    }
    if (artist.albumCount === 1
      && presentation.primary.target.id !== artist.albumIds[0]
      && !primaryArtistIds.includes(artist.artistId)
      && evidence) {
      singleWorkTruthfulEscapes += 1;
    }
    if (options.every((option) =>
      publishedDiscoveryIndex.albumFactsById.has(option.target.id)
      && hrefResolves(option.href, option.target.slug))) {
      validArtistContinuations += 1;
    }
  }

  let validTopicContinuations = 0;
  let topicsWithoutContinuation = 0;
  let topicInvalidTargets = 0;
  let topicUnresolvedTargets = 0;
  let topicDuplicateDestinations = 0;
  let topicExplanationFailures = 0;
  let topicDeterministicReplayFailures = 0;
  const topics = topicKinds.flatMap((kind) =>
    getTopicSummaries(kind).map((topic) => ({ kind, topic })));
  for (const { kind, topic } of topics) {
    const presentation = buildTopicDiscoveryPresentation(kind, topic.key);
    const replay = buildTopicDiscoveryPresentation(kind, topic.key);
    if (JSON.stringify(presentation) !== JSON.stringify(replay)) topicDeterministicReplayFailures += 1;
    if (!presentation) {
      topicsWithoutContinuation += 1;
      continue;
    }
    const options = [presentation.primary, ...presentation.alternates];
    topicInvalidTargets += options.filter((option) =>
      !publishedDiscoveryIndex.albumFactsById.has(option.target.id)).length;
    topicUnresolvedTargets += options.filter((option) =>
      !hrefResolves(option.href, option.target.slug)).length;
    topicDuplicateDestinations += duplicateTargetCount(presentation);
    if (!topicTargetHasMembership(presentation)
      || !presentation.primary.explanation
      || presentation.primary.explanationKey !== "discovery.topic.to_album") {
      topicExplanationFailures += 1;
    }
    if (options.every((option) =>
      publishedDiscoveryIndex.albumFactsById.has(option.target.id)
      && hrefResolves(option.href, option.target.slug))) {
      validTopicContinuations += 1;
    }
  }

  return Object.freeze({
    artists: Object.freeze({
      evaluated: publishedArtists.length,
      multiWork: publishedArtists.filter((artist) => artist.albumCount > 1).length,
      singleWork: publishedArtists.filter((artist) => artist.albumCount === 1).length,
      validContinuations: validArtistContinuations,
      multiWorkPreservingChronology,
      singleWorkTruthfulEscapes,
      withoutContinuation: artistsWithoutContinuation,
      invalidDestinations: artistInvalidDestinations,
      unresolvedDestinations: artistUnresolvedDestinations,
      duplicateDestinations: artistDuplicateDestinations,
      explanationEvidenceFailures: artistExplanationEvidenceFailures,
      deterministicReplayFailures: artistDeterministicReplayFailures,
    }),
    topics: Object.freeze({
      evaluated: topics.length,
      validContinuations: validTopicContinuations,
      withoutContinuation: topicsWithoutContinuation,
      invalidTargets: topicInvalidTargets,
      unresolvedTargets: topicUnresolvedTargets,
      duplicateDestinations: topicDuplicateDestinations,
      explanationFailures: topicExplanationFailures,
      deterministicReplayFailures: topicDeterministicReplayFailures,
    }),
  });
}

type EntityHop = Readonly<{
  kind: "ARTIST" | "PRIMARY_GENRE" | "SECONDARY_GENRE" | "ERA" | "LISTENING_CONTEXT";
  key: string;
  pathname: string;
}>; 

type VisibleTransitionKind = EntityHop["kind"] | "ALBUM";

function possibleHops(albumId: string): readonly EntityHop[] {
  const facts = publishedDiscoveryIndex.albumFactsById.get(albumId);
  if (!facts) return [];
  const hops: EntityHop[] = [];
  facts.artistIds.forEach((artistId) => {
    const artist = artistById.get(artistId);
    if (artist) hops.push({ kind: "ARTIST", key: artistId, pathname: `/artists/${artist.slug}` });
  });
  facts.primaryGenres.forEach((key) => {
    if ((publishedDiscoveryIndex.albumIdsByPrimaryGenre.get(key)?.length ?? 0) > 1) {
      hops.push({ kind: "PRIMARY_GENRE", key, pathname: `/genres/core/${key}` });
    }
  });
  facts.secondaryGenres.forEach((key) => {
    if ((publishedDiscoveryIndex.albumIdsBySecondaryGenre.get(key)?.length ?? 0) > 1) {
      hops.push({ kind: "SECONDARY_GENRE", key, pathname: `/genres/related/${key}` });
    }
  });
  if (facts.era && (publishedDiscoveryIndex.albumIdsByEra.get(facts.era)?.length ?? 0) > 1) {
    hops.push({ kind: "ERA", key: facts.era, pathname: `/decades/${facts.era}` });
  }
  facts.listeningContexts.forEach((key) => {
    if ((publishedDiscoveryIndex.albumIdsByListeningContext.get(key)?.length ?? 0) > 1) {
      hops.push({ kind: "LISTENING_CONTEXT", key, pathname: `/scenes/${key}` });
    }
  });
  return hops;
}

function presentationForHop(hop: EntityHop, query: URLSearchParams) {
  if (hop.kind === "ARTIST") return buildArtistDiscoveryPresentation(hop.key, parseDiscoveryPathContext(query, publishedDiscoveryIndex));
  if (hop.kind === "PRIMARY_GENRE") return buildTopicDiscoveryPresentation("core", hop.key, parseDiscoveryPathContext(query, publishedDiscoveryIndex));
  if (hop.kind === "SECONDARY_GENRE") return buildTopicDiscoveryPresentation("related", hop.key, parseDiscoveryPathContext(query, publishedDiscoveryIndex));
  if (hop.kind === "ERA") return buildTopicDiscoveryPresentation("decade", hop.key, parseDiscoveryPathContext(query, publishedDiscoveryIndex));
  return buildTopicDiscoveryPresentation("scene", hop.key, parseDiscoveryPathContext(query, publishedDiscoveryIndex));
}

export function simulateVisibleArtistTopicPaths({ seedCount = 80, stepsPerSeed = 20 } = {}) {
  const multiAlbums = catalogAlbums.filter((album) =>
    album.artists.some((credit) => (artistById.get(credit.id)?.albumCount ?? 0) > 1));
  const singleAlbums = catalogAlbums.filter((album) =>
    album.artists.some((credit) => artistById.get(credit.id)?.albumCount === 1));
  const paths: Array<Readonly<{
    seed: number;
    initialShape: "MULTI_WORK" | "SINGLE_WORK";
    transitions: readonly Readonly<{
      step: number;
      sourceAlbumId: string;
      entityKind: VisibleTransitionKind;
      entityKey: string;
      targetAlbumId: string;
      explanationKey: string;
      explanation: string;
    }>[];
  }>> = [];
  let completedTransitions = 0;
  let deadEnds = 0;
  let immediateReversals = 0;
  let truthfulExhaustionReversals = 0;
  let avoidableShortLoops = 0;
  let invalidRoutes = 0;
  let unresolvedEntities = 0;
  let explanationFailures = 0;
  let deterministicReplayFailures = 0;
  const entityTypeCounts: Record<string, number> = {};

  for (let seed = 0; seed < seedCount; seed += 1) {
    const initialShape = seed % 2 ? "SINGLE_WORK" as const : "MULTI_WORK" as const;
    const pool = initialShape === "MULTI_WORK" ? multiAlbums : singleAlbums;
    let current = pool[seed % pool.length];
    let currentQuery = "";
    const visited = [current.slug];
    const transitions: Array<{
      step: number;
      sourceAlbumId: string;
      entityKind: VisibleTransitionKind;
      entityKey: string;
      targetAlbumId: string;
      explanationKey: string;
      explanation: string;
    }> = [];

    for (let step = 0; step < stepsPerSeed; step += 1) {
      const useEntityHop = step % 4 === 0;
      const hops = useEntityHop ? possibleHops(current.id) : [];
      if (useEntityHop && !hops.length) {
        deadEnds += 1;
        break;
      }
      const hop = useEntityHop ? hops[(seed * 7 + step * 3) % hops.length] : null;
      const transitionKind: VisibleTransitionKind = hop?.kind ?? "ALBUM";
      const transitionKey = hop?.key ?? current.slug;
      entityTypeCounts[transitionKind] = (entityTypeCounts[transitionKind] ?? 0) + 1;
      const context = parseDiscoveryPathContext(currentQuery, publishedDiscoveryIndex);
      const entityHref = hop
        ? buildDiscoveryEntityHref(hop.pathname, current.slug, currentQuery)
        : null;
      const entityUrl = entityHref ? new URL(entityHref, "https://local.test") : null;
      const presentation = hop
        ? presentationForHop(hop, entityUrl!.searchParams)
        : buildAlbumDiscoveryPresentation(current.id, context);
      const replay = hop
        ? presentationForHop(hop, entityUrl!.searchParams)
        : presentation;
      if (JSON.stringify(presentation) !== JSON.stringify(replay)) deterministicReplayFailures += 1;
      if (!presentation) {
        unresolvedEntities += 1;
        break;
      }
      if (!presentation.primary) {
        deadEnds += 1;
        break;
      }
      const options = [presentation.primary, ...presentation.alternates];
      const target = albumById.get(presentation.primary.target.id);
      if (!target || !hrefResolves(presentation.primary.href, presentation.primary.target.slug)) {
        invalidRoutes += 1;
        break;
      }
      if (!presentation.primary.explanation || !presentation.primary.explanationKey) explanationFailures += 1;
      const recent = new Set(visited.slice(-3));
      const targetIsRecent = recent.has(target.slug);
      const truthfulFreshAlternative = options.some((option) => !recent.has(option.target.slug));
      if (targetIsRecent && truthfulFreshAlternative) avoidableShortLoops += 1;
      if (visited.at(-2) === target.slug) {
        immediateReversals += 1;
        if (!truthfulFreshAlternative) truthfulExhaustionReversals += 1;
      }
      const targetUrl = new URL(presentation.primary.href, "https://local.test");
      const targetContext = parseDiscoveryPathContext(targetUrl.searchParams, publishedDiscoveryIndex);
      if (targetContext.trailAlbumSlugs.length > 3 || targetContext.transitionFamilies.length > 3) invalidRoutes += 1;
      transitions.push({
        step,
        sourceAlbumId: current.id,
        entityKind: transitionKind,
        entityKey: transitionKey,
        targetAlbumId: target.id,
        explanationKey: presentation.primary.explanationKey,
        explanation: presentation.primary.explanation,
      });
      completedTransitions += hop ? 2 : 1;
      current = target;
      currentQuery = targetUrl.searchParams.toString();
      visited.push(current.slug);
    }
    paths.push(Object.freeze({ seed, initialShape, transitions: Object.freeze(transitions) }));
  }

  return Object.freeze({
    summary: Object.freeze({
      seedCount,
      stepsPerSeed,
      requestedTransitions: seedCount * (stepsPerSeed + Math.ceil(stepsPerSeed / 4)),
      completedTransitions,
      deadEnds,
      immediateReversals,
      truthfulExhaustionReversals,
      avoidableShortLoops,
      invalidRoutes,
      unresolvedEntities,
      explanationFailures,
      deterministicReplayFailures,
      entityTypeCounts: Object.freeze(entityTypeCounts),
    }),
    representativePaths: Object.freeze([
      paths.find((path) => path.initialShape === "MULTI_WORK"),
      paths.find((path) => path.initialShape === "SINGLE_WORK"),
    ].filter(Boolean)),
    paths: Object.freeze(paths),
  });
}
