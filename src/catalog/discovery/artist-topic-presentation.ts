import { getTopic, type TopicKind } from "../topics";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import { discoverFromArtist } from "./candidate-engine";
import type {
  ArtistEscapeExplanation,
  DiscoveryEntryExplanationKey,
  DiscoveryExplanationKey,
} from "./explanations";
import {
  EMPTY_DISCOVERY_PATH_CONTEXT,
  appendDiscoveryEntityPathContext,
  parseDiscoveryPathContext,
  serializeDiscoveryPathContext,
  type DiscoveryPathContext,
  type DiscoveryTransitionFamily,
} from "./path-context";
import {
  buildAlbumDiscoveryOption,
  getAlbumDiscoveryTarget,
  getDiscoveryEntryLabel,
  getDiscoveryExplanationCopy,
  type AlbumDiscoveryTarget,
} from "./presentation";
import { publishedDiscoveryIndex } from "./published-index";
import { discoverFromTopic, type TopicEntryKind } from "./topic-entry";

export interface EntityDiscoveryOption {
  readonly target: AlbumDiscoveryTarget;
  readonly href: string;
  readonly lens: string;
  readonly explanation: string;
  readonly explanationKey: DiscoveryExplanationKey | DiscoveryEntryExplanationKey;
  readonly transitionFamily: DiscoveryTransitionFamily | null;
}

interface EntityDiscoveryPathPresentation {
  readonly active: boolean;
  readonly entryLabel: string | null;
  readonly previousAlbumTitle: string | null;
  readonly resetHref: string;
}

export interface ArtistDiscoveryPresentation {
  readonly kind: "ARTIST";
  readonly source: Readonly<{
    id: string;
    slug: string;
    name: string;
    workCount: number;
    shape: "MULTI_WORK" | "SINGLE_WORK";
  }>;
  readonly primary: EntityDiscoveryOption;
  readonly alternates: readonly EntityDiscoveryOption[];
  readonly escapeReason: ReturnType<typeof discoverFromArtist>["escapeReason"];
  readonly path: EntityDiscoveryPathPresentation;
}

export interface TopicDiscoveryPresentation {
  readonly kind: "TOPIC";
  readonly source: Readonly<{
    kind: TopicKind;
    key: string;
    label: string;
    count: number;
  }>;
  readonly primary: EntityDiscoveryOption;
  readonly alternates: readonly EntityDiscoveryOption[];
  readonly path: EntityDiscoveryPathPresentation;
}

const albumBySlug = new Map(catalogAlbums.map((album) => [album.slug, album] as const));

function normalizedContext(context: DiscoveryPathContext) {
  return parseDiscoveryPathContext(
    serializeDiscoveryPathContext(context),
    publishedDiscoveryIndex,
  );
}

function pathPresentation(
  context: DiscoveryPathContext,
  resetHref: string,
): EntityDiscoveryPathPresentation {
  const previousSlug = context.trailAlbumSlugs.at(-1);
  return Object.freeze({
    active: Boolean(
      context.entryKind
      || context.trailAlbumSlugs.length
      || context.transitionFamilies.length,
    ),
    entryLabel: getDiscoveryEntryLabel(context),
    previousAlbumTitle: previousSlug ? albumBySlug.get(previousSlug)?.title ?? null : null,
    resetHref,
  });
}

function artistEscapeCopy(
  artistName: string,
  artistShape: "MULTI_WORK" | "SINGLE_WORK",
  anchorAlbumId: string,
  explanation: ArtistEscapeExplanation,
) {
  const anchor = getAlbumDiscoveryTarget(anchorAlbumId);
  const supporting = getDiscoveryExplanationCopy(explanation.supportingExplanation);
  const origin = artistShape === "SINGLE_WORK"
    ? `${artistName}目前收录的唯一作品${anchor ? `《${anchor.title}》` : ""}`
    : `${artistName}的作品年表`;
  return Object.freeze({
    lens: artistShape === "SINGLE_WORK" ? `馆藏出口 · ${supporting.lens}` : `年表出口 · ${supporting.lens}`,
    explanation: `从${origin}出发；${supporting.explanation}`,
  });
}

function artistPrimaryOption(
  result: Extract<ReturnType<typeof discoverFromArtist>, { status: "FOUND" }> | ReturnType<typeof discoverFromArtist>,
  artistName: string,
): EntityDiscoveryOption | null {
  const candidate = result.discovery?.status === "FOUND" ? result.discovery.primary : null;
  const target = candidate ? getAlbumDiscoveryTarget(candidate.targetAlbumId) : null;
  if (!candidate || !target || !result.primaryExplanation || !result.artistShape) return null;
  const query = serializeDiscoveryPathContext(candidate.nextPathContext);
  const copy = result.primaryExplanation.key === "discovery.artist.escape"
    ? artistEscapeCopy(
      artistName,
      result.artistShape,
      result.primaryExplanation.evidence.anchorAlbumId,
      result.primaryExplanation,
    )
    : getDiscoveryExplanationCopy(result.primaryExplanation);
  return Object.freeze({
    target,
    href: query ? `/albums/${target.slug}?${query}` : `/albums/${target.slug}/`,
    lens: copy.lens,
    explanation: copy.explanation,
    explanationKey: result.primaryExplanation.key,
    transitionFamily: candidate.transitionFamily,
  });
}

export function buildArtistDiscoveryPresentation(
  artistId: string,
  context: DiscoveryPathContext = EMPTY_DISCOVERY_PATH_CONTEXT,
): ArtistDiscoveryPresentation | null {
  const artist = publishedArtists.find((candidate) => candidate.artistId === artistId);
  if (!artist) return null;
  const normalized = normalizedContext(context);
  const previousAlbum = normalized.trailAlbumSlugs.length
    ? albumBySlug.get(normalized.trailAlbumSlugs.at(-1) ?? "")
    : null;
  const anchorAlbumId = previousAlbum?.artists.some((credit) => credit.id === artistId)
    ? previousAlbum.id
    : undefined;
  const result = discoverFromArtist(publishedDiscoveryIndex, artistId, {
    ...(anchorAlbumId ? { anchorAlbumId } : {}),
    ...(normalized.entryKind ? { pathContext: normalized } : {}),
  });
  if (result.status !== "FOUND" || !result.artistShape) return null;
  const primary = artistPrimaryOption(result, artist.name);
  if (!primary) return null;
  const alternates = result.alternates.flatMap((candidate): EntityDiscoveryOption[] => {
    const option = buildAlbumDiscoveryOption(candidate);
    return option ? [Object.freeze({ ...option, transitionFamily: candidate.transitionFamily })] : [];
  });
  return Object.freeze({
    kind: "ARTIST",
    source: Object.freeze({
      id: artist.artistId,
      slug: artist.slug,
      name: artist.name,
      workCount: artist.albumCount,
      shape: result.artistShape,
    }),
    primary,
    alternates: Object.freeze(alternates),
    escapeReason: result.escapeReason,
    path: pathPresentation(normalized, `/artists/${artist.slug}/`),
  });
}

export function buildArtistDiscoveryPresentationFromSearchParams(
  artistId: string,
  searchParams: string | URLSearchParams,
) {
  return buildArtistDiscoveryPresentation(
    artistId,
    parseDiscoveryPathContext(searchParams, publishedDiscoveryIndex),
  );
}

const TOPIC_TYPE_BY_KIND: Readonly<Record<TopicKind, TopicEntryKind>> = Object.freeze({
  core: "PRIMARY_GENRE",
  related: "SECONDARY_GENRE",
  decade: "ERA",
  scene: "LISTENING_CONTEXT",
});

function topicLens(kind: TopicKind) {
  if (kind === "core") return "核心流派入口";
  if (kind === "related") return "相关流派入口";
  if (kind === "decade") return "年代入口";
  return "聆听场景入口";
}

function topicPathname(kind: TopicKind, key: string) {
  if (kind === "core") return `/genres/core/${key}/`;
  if (kind === "related") return `/genres/related/${key}/`;
  if (kind === "decade") return `/discover?decade=${encodeURIComponent(key)}`;
  return `/scenes/${key}/`;
}

export function buildTopicDiscoveryPresentation(
  kind: TopicKind,
  topicKey: string,
  context: DiscoveryPathContext = EMPTY_DISCOVERY_PATH_CONTEXT,
): TopicDiscoveryPresentation | null {
  const topic = getTopic(kind, topicKey);
  if (!topic) return null;
  const normalized = normalizedContext(context);
  const result = discoverFromTopic(
    publishedDiscoveryIndex,
    TOPIC_TYPE_BY_KIND[kind],
    topic.key,
    normalized.entryKind ? { pathContext: normalized } : {},
  );
  if (result.status !== "FOUND" || !result.primaryTarget) return null;
  const toOption = (
    anchor: NonNullable<typeof result.primaryTarget>,
    position: "PRIMARY" | "ALTERNATE",
  ): EntityDiscoveryOption | null => {
    const target = getAlbumDiscoveryTarget(anchor.albumId);
    if (!target) return null;
    return Object.freeze({
      target,
      href: anchor.href,
      lens: topicLens(kind),
      explanation: position === "PRIMARY"
        ? `从“${topic.label}”的真实馆藏成员《${target.title}》进入，再沿专辑页中的可说明关系继续。`
        : `同属“${topic.label}”的馆藏成员，也可以从《${target.title}》进入另一条专辑路径。`,
      explanationKey: anchor.explanation.key,
      transitionFamily: null,
    });
  };
  const primary = toOption(result.primaryTarget, "PRIMARY");
  if (!primary) return null;
  const alternates = result.alternates.flatMap((anchor): EntityDiscoveryOption[] => {
    const option = toOption(anchor, "ALTERNATE");
    return option ? [option] : [];
  });
  return Object.freeze({
    kind: "TOPIC",
    source: Object.freeze({
      kind,
      key: topic.key,
      label: topic.label,
      count: topic.count,
    }),
    primary,
    alternates: Object.freeze(alternates),
    path: pathPresentation(normalized, topicPathname(kind, topic.key)),
  });
}

export function buildTopicDiscoveryPresentationFromSearchParams(
  kind: TopicKind,
  topicKey: string,
  searchParams: string | URLSearchParams,
) {
  return buildTopicDiscoveryPresentation(
    kind,
    topicKey,
    parseDiscoveryPathContext(searchParams, publishedDiscoveryIndex),
  );
}

export function buildDiscoveryEntityHref(
  pathname: string,
  currentAlbumSlug: string,
  searchParams: string | URLSearchParams,
) {
  const incoming = parseDiscoveryPathContext(searchParams, publishedDiscoveryIndex);
  const nextContext = appendDiscoveryEntityPathContext(incoming, currentAlbumSlug);
  const query = serializeDiscoveryPathContext(nextContext);
  return query ? `${pathname}${pathname.includes("?") ? "&" : "?"}${query}` : pathname;
}
