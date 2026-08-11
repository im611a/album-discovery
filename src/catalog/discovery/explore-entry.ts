import { getSeededRandomAlbum } from "../exploration";
import type { PublishedAlbumSummary } from "../schema";
import {
  discoverFromAlbum,
  discoverFromArtist,
  type DiscoverFromAlbumResult,
} from "./candidate-engine";
import type { DiscoveryEntryExplanation, DiscoveryExplanation } from "./explanations";
import {
  parseDiscoveryPathContext,
  serializeDiscoveryPathContext,
  type DiscoveryPathContext,
} from "./path-context";
import { discoverFromTopic, type TopicEntryKind } from "./topic-entry";
import type { AlbumRelationEvidence, DiscoveryIndex, DiscoveryRelationType } from "./types";

export type ExploreRelationSource =
  | Readonly<{ kind: "ALBUM"; key: string }>
  | Readonly<{ kind: "ARTIST"; key: string }>
  | Readonly<{ kind: TopicEntryKind; key: string }>;

export type ExploreEntryRequest =
  | Readonly<{
    mode: "RANDOM_ENTRY";
    seed: string;
    dismissedAlbumIds?: readonly string[];
  }>
  | Readonly<{
    mode: "RELATION_ENTRY";
    source: ExploreRelationSource;
  }>;

export interface ExploreEntryTarget {
  readonly albumId: string;
  readonly slug: string;
  readonly href: string;
}

export interface ExploreRandomEntryResult {
  readonly status: "FOUND" | "EMPTY";
  readonly mode: "RANDOM_ENTRY";
  readonly seed: string;
  readonly target: ExploreEntryTarget | null;
  readonly explanation: null;
  readonly relation: null;
  readonly relationEvidence: null;
  readonly pathContext: DiscoveryPathContext;
}

export interface ExploreRelationEntryResult {
  readonly status: "FOUND" | "NOT_FOUND" | "EMPTY";
  readonly mode: "RELATION_ENTRY";
  readonly source: ExploreRelationSource;
  readonly target: ExploreEntryTarget | null;
  readonly explanation: DiscoveryExplanation | DiscoveryEntryExplanation | null;
  readonly relation: DiscoveryRelationType | null;
  readonly relationEvidence: AlbumRelationEvidence | null;
  readonly continuation: DiscoverFromAlbumResult | null;
  readonly pathContext: DiscoveryPathContext;
}

export type ExploreEntryResult = ExploreRandomEntryResult | ExploreRelationEntryResult;

function exploreContext(index: DiscoveryIndex) {
  return parseDiscoveryPathContext("entry=explore", index);
}

function targetFor(albumId: string, slug: string, context: DiscoveryPathContext): ExploreEntryTarget {
  const query = serializeDiscoveryPathContext(context);
  return Object.freeze({
    albumId,
    slug,
    href: query ? `/albums/${slug}?${query}` : `/albums/${slug}/`,
  });
}

export function buildExploreEntry(
  index: DiscoveryIndex,
  albums: readonly PublishedAlbumSummary[],
  request: ExploreEntryRequest,
): ExploreEntryResult {
  const pathContext = exploreContext(index);
  if (request.mode === "RANDOM_ENTRY") {
    const album = getSeededRandomAlbum(request.seed, [...albums], [...(request.dismissedAlbumIds ?? [])]);
    return Object.freeze({
      status: album ? "FOUND" : "EMPTY",
      mode: "RANDOM_ENTRY",
      seed: request.seed,
      target: album ? targetFor(album.id, album.slug, pathContext) : null,
      explanation: null,
      relation: null,
      relationEvidence: null,
      pathContext,
    });
  }

  if (request.source.kind === "ALBUM") {
    const discovery = discoverFromAlbum(index, request.source.key, pathContext);
    const primary = discovery.status === "FOUND" ? discovery.primary : null;
    const relationEvidence = primary ? Object.freeze({
      sourceAlbumId: primary.sourceAlbumId,
      targetAlbumId: primary.targetAlbumId,
      relations: primary.relations,
    }) : null;
    return Object.freeze({
      status: discovery.status,
      mode: "RELATION_ENTRY",
      source: request.source,
      target: primary ? targetFor(primary.targetAlbumId, primary.targetSlug, primary.nextPathContext) : null,
      explanation: primary?.explanation ?? null,
      relation: primary?.primaryRelation ?? null,
      relationEvidence,
      continuation: discovery,
      pathContext,
    });
  }

  if (request.source.kind === "ARTIST") {
    const artist = discoverFromArtist(index, request.source.key, { pathContext });
    const primary = artist.discovery?.status === "FOUND" ? artist.discovery.primary : null;
    return Object.freeze({
      status: artist.status === "NOT_FOUND" ? "NOT_FOUND" : primary ? "FOUND" : "EMPTY",
      mode: "RELATION_ENTRY",
      source: request.source,
      target: artist.primaryTarget
        ? targetFor(
          artist.primaryTarget.albumId,
          artist.primaryTarget.slug,
          primary?.nextPathContext ?? pathContext,
        )
        : null,
      explanation: artist.primaryExplanation,
      relation: artist.primaryRelation,
      relationEvidence: artist.primaryEvidence,
      continuation: artist.discovery,
      pathContext,
    });
  }

  const topic = discoverFromTopic(index, request.source.kind, request.source.key, { pathContext });
  return Object.freeze({
    status: topic.status,
    mode: "RELATION_ENTRY",
    source: request.source,
    target: topic.primaryTarget
      ? targetFor(topic.primaryTarget.albumId, topic.primaryTarget.slug, topic.pathContext)
      : null,
    explanation: topic.primaryTarget?.explanation ?? null,
    relation: null,
    relationEvidence: null,
    continuation: topic.discovery,
    pathContext,
  });
}
