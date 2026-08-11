import {
  compareDiscoveryRankKeys,
  discoverFromAlbum,
  type DiscoverFromAlbumResult,
  type DiscoveryRankKey,
} from "./candidate-engine";
import {
  buildTopicEntryExplanation,
  type TopicDiscoveryNodeType,
  type TopicEntryExplanation,
} from "./explanations";
import {
  parseDiscoveryPathContext,
  serializeDiscoveryPathContext,
  type DiscoveryEntryKind,
  type DiscoveryPathContext,
} from "./path-context";
import { compareCanonicalValues } from "./relation-index";
import type { DiscoveryIndex } from "./types";

export const TOPIC_ENTRY_KINDS = [
  "PRIMARY_GENRE",
  "SECONDARY_GENRE",
  "ERA",
  "LISTENING_CONTEXT",
] as const satisfies readonly TopicDiscoveryNodeType[];

export type TopicEntryKind = (typeof TOPIC_ENTRY_KINDS)[number];

export interface TopicEntryAnchor {
  readonly albumId: string;
  readonly slug: string;
  readonly href: string;
  readonly explanation: TopicEntryExplanation;
  readonly continuationRankKey: DiscoveryRankKey | null;
}

export interface DiscoverFromTopicResult {
  readonly status: "FOUND" | "NOT_FOUND";
  readonly topicType: TopicEntryKind;
  readonly topicKey: string;
  readonly memberAlbumIds: readonly string[];
  readonly primaryTargetType: "ALBUM" | null;
  readonly primaryTarget: TopicEntryAnchor | null;
  readonly alternates: readonly TopicEntryAnchor[];
  readonly discovery: DiscoverFromAlbumResult | null;
  readonly pathContext: DiscoveryPathContext;
}

const ENTRY_KIND_BY_TOPIC: Readonly<Record<TopicEntryKind, DiscoveryEntryKind>> = Object.freeze({
  PRIMARY_GENRE: "primary-genre",
  SECONDARY_GENRE: "secondary-genre",
  ERA: "era",
  LISTENING_CONTEXT: "listening-context",
});

function membersFor(index: DiscoveryIndex, topicType: TopicEntryKind, topicKey: string) {
  if (topicType === "PRIMARY_GENRE") return index.albumIdsByPrimaryGenre.get(topicKey) ?? [];
  if (topicType === "SECONDARY_GENRE") return index.albumIdsBySecondaryGenre.get(topicKey) ?? [];
  if (topicType === "ERA") return index.albumIdsByEra.get(topicKey) ?? [];
  return index.albumIdsByListeningContext.get(topicKey) ?? [];
}

function topicPathContext(
  index: DiscoveryIndex,
  topicType: TopicEntryKind,
  topicKey: string,
  provided?: DiscoveryPathContext,
) {
  const base = provided?.entryKind ? provided : Object.freeze({
    entryKind: ENTRY_KIND_BY_TOPIC[topicType],
    entryKey: topicKey,
    trailAlbumSlugs: provided?.trailAlbumSlugs ?? Object.freeze([]),
    transitionFamilies: provided?.transitionFamilies ?? Object.freeze([]),
  });
  return parseDiscoveryPathContext(serializeDiscoveryPathContext(base), index);
}

function canonicalAlbumHref(slug: string, context: DiscoveryPathContext) {
  const query = serializeDiscoveryPathContext(context);
  return query ? `/albums/${slug}?${query}` : `/albums/${slug}/`;
}

interface EvaluatedMember {
  readonly albumId: string;
  readonly slug: string;
  readonly discovery: DiscoverFromAlbumResult;
  readonly rankKey: DiscoveryRankKey | null;
}

function compareEvaluatedMembers(left: EvaluatedMember, right: EvaluatedMember) {
  if (left.rankKey && !right.rankKey) return -1;
  if (!left.rankKey && right.rankKey) return 1;
  if (left.rankKey && right.rankKey) {
    const order = compareDiscoveryRankKeys(left.rankKey, right.rankKey);
    if (order) return order;
  }
  return compareCanonicalValues(left.albumId, right.albumId);
}

export function discoverFromTopic(
  index: DiscoveryIndex,
  topicType: TopicEntryKind,
  topicKey: string,
  options: { readonly pathContext?: DiscoveryPathContext } = {},
): DiscoverFromTopicResult {
  const pathContext = topicPathContext(index, topicType, topicKey, options.pathContext);
  const nodeExists = index.nodes.some((node) => node.type === topicType && node.canonicalId === topicKey);
  const memberAlbumIds = Object.freeze([...membersFor(index, topicType, topicKey)]);
  if (!nodeExists || !memberAlbumIds.length || !pathContext.entryKind) {
    return Object.freeze({
      status: "NOT_FOUND",
      topicType,
      topicKey,
      memberAlbumIds,
      primaryTargetType: null,
      primaryTarget: null,
      alternates: Object.freeze([]),
      discovery: null,
      pathContext,
    });
  }

  const rankedMembers = memberAlbumIds.flatMap((albumId): EvaluatedMember[] => {
    const facts = index.albumFactsById.get(albumId);
    if (!facts) return [];
    const discovery = discoverFromAlbum(index, albumId, pathContext);
    return [{
      albumId,
      slug: facts.slug,
      discovery,
      rankKey: discovery.status === "FOUND" ? discovery.primary?.rankKey ?? null : null,
    }];
  }).sort(compareEvaluatedMembers);
  const recentSlugs = new Set(pathContext.trailAlbumSlugs);
  const hasUnvisitedMember = rankedMembers.some((member) => !recentSlugs.has(member.slug));
  const evaluated = hasUnvisitedMember && recentSlugs.size
    ? [
      ...rankedMembers.filter((member) => !recentSlugs.has(member.slug)),
      ...rankedMembers.filter((member) => recentSlugs.has(member.slug)),
    ]
    : rankedMembers;

  const anchors = Object.freeze(evaluated.flatMap((member): TopicEntryAnchor[] => {
    const explanation = buildTopicEntryExplanation(index, topicType, topicKey, member.albumId);
    if (!explanation) return [];
    return [Object.freeze({
      albumId: member.albumId,
      slug: member.slug,
      href: canonicalAlbumHref(member.slug, pathContext),
      explanation,
      continuationRankKey: member.rankKey,
    })];
  }));
  const primaryTarget = anchors[0] ?? null;
  const primaryEvaluation = primaryTarget
    ? evaluated.find((member) => member.albumId === primaryTarget.albumId) ?? null
    : null;

  return Object.freeze({
    status: primaryTarget ? "FOUND" : "NOT_FOUND",
    topicType,
    topicKey,
    memberAlbumIds,
    primaryTargetType: primaryTarget ? "ALBUM" : null,
    primaryTarget,
    alternates: Object.freeze(anchors.slice(1, 4)),
    discovery: primaryEvaluation?.discovery ?? null,
    pathContext,
  });
}
