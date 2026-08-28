import { buildExploreOptions } from "../exploration";
import { getListeningSceneLabel } from "../listening-scenes";
import { catalogAlbums, getTaxonomyLabel, publishedArtists } from "../published-catalog";
import type { TopicKind } from "../topics";
import type { ExploreRelationSource } from "./explore-entry";
import { buildExploreEntry } from "./explore-entry";
import { parseDiscoveryPathContext, serializeDiscoveryPathContext } from "./path-context";
import {
  buildAlbumDiscoveryOption,
  getAlbumDiscoveryTarget,
  getDiscoveryExplanationCopy,
  type AlbumDiscoveryTarget,
} from "./presentation";
import { publishedDiscoveryIndex } from "./published-index";
import { buildTopicDiscoveryPresentation } from "./artist-topic-presentation";

export type ExploreRelationMode = "genre" | "decade" | "scene" | "artist";
export type ExploreGenreKind = "core" | "related";

export interface ExploreRelationChoice {
  readonly mode: ExploreRelationMode;
  readonly value: string;
  readonly kind: ExploreGenreKind | null;
  readonly token: string;
  readonly label: string;
  readonly count: number;
  readonly source: ExploreRelationSource;
}

export interface ExplorePresentationOption {
  readonly target: AlbumDiscoveryTarget;
  readonly href: string;
  readonly lens: string;
  readonly explanation: string;
  readonly explanationKey: string;
  readonly relationFamily: string | null;
}

export interface ExploreRelationPresentation {
  readonly authority: "RELATION";
  readonly choice: ExploreRelationChoice;
  readonly sourceLabel: string;
  readonly sourceKindLabel: string;
  readonly sourceHref: string;
  readonly sourceAction: string;
  readonly primary: ExplorePresentationOption;
  readonly alternates: readonly ExplorePresentationOption[];
  readonly pathContext: string;
}

export interface ExploreRandomPresentation {
  readonly authority: "SERENDIPITY";
  readonly seed: string;
  readonly target: AlbumDiscoveryTarget;
  readonly href: string;
  readonly relationFamily: null;
  readonly explanationKey: null;
  readonly explanation: null;
  readonly pathContext: string;
}

const options = buildExploreOptions();
const exploreContext = parseDiscoveryPathContext("entry=explore", publishedDiscoveryIndex);
const exploreQuery = serializeDiscoveryPathContext(exploreContext);

const genreChoices: readonly ExploreRelationChoice[] = Object.freeze([
  ...options.coreGenres.map((option) => Object.freeze({
    mode: "genre" as const,
    value: option.value,
    kind: "core" as const,
    token: `core:${option.value}`,
    label: `核心流派 · ${option.label}`,
    count: option.count,
    source: Object.freeze({ kind: "PRIMARY_GENRE" as const, key: option.value }),
  })),
  ...options.relatedGenres.map((option) => Object.freeze({
    mode: "genre" as const,
    value: option.value,
    kind: "related" as const,
    token: `related:${option.value}`,
    label: `相关流派 · ${option.label}`,
    count: option.count,
    source: Object.freeze({ kind: "SECONDARY_GENRE" as const, key: option.value }),
  })),
]);

const choicesByMode: Readonly<Record<ExploreRelationMode, readonly ExploreRelationChoice[]>> = Object.freeze({
  genre: genreChoices,
  decade: Object.freeze(options.decades.map((option) => Object.freeze({
    mode: "decade" as const,
    value: option.value,
    kind: null,
    token: option.value,
    label: option.label,
    count: option.count,
    source: Object.freeze({ kind: "ERA" as const, key: option.value }),
  }))),
  scene: Object.freeze(options.scenes.map((option) => Object.freeze({
    mode: "scene" as const,
    value: option.value,
    kind: null,
    token: option.value,
    label: option.label,
    count: option.count,
    source: Object.freeze({ kind: "LISTENING_CONTEXT" as const, key: option.value }),
  }))),
  artist: Object.freeze(options.artists.map((option) => Object.freeze({
    mode: "artist" as const,
    value: option.value,
    kind: null,
    token: option.value,
    label: option.label,
    count: option.count,
    source: Object.freeze({ kind: "ARTIST" as const, key: option.value }),
  }))),
});

export function getExploreRelationChoices(mode: ExploreRelationMode) {
  return choicesByMode[mode];
}

export function resolveExploreRelationChoice(
  mode: ExploreRelationMode,
  value: string | null,
  genreKind: string | null,
) {
  const choices = getExploreRelationChoices(mode);
  if (mode === "genre" && value) {
    const requestedKind = genreKind === "related" ? "related" : genreKind === "core" ? "core" : null;
    return choices.find((choice) => choice.value === value && (!requestedKind || choice.kind === requestedKind))
      ?? choices.find((choice) => choice.value === value)
      ?? choices[0]
      ?? null;
  }
  return choices.find((choice) => choice.value === value) ?? choices[0] ?? null;
}

function topicKind(source: ExploreRelationSource): TopicKind | null {
  if (source.kind === "PRIMARY_GENRE") return "core";
  if (source.kind === "SECONDARY_GENRE") return "related";
  if (source.kind === "ERA") return "decade";
  if (source.kind === "LISTENING_CONTEXT") return "scene";
  return null;
}

function sourcePresentation(choice: ExploreRelationChoice) {
  if (choice.source.kind === "ARTIST") {
    const artist = publishedArtists.find((candidate) => candidate.artistId === choice.source.key);
    if (!artist) return null;
    return {
      label: artist.name,
      kindLabel: "艺人作品档案",
      href: `/artists/${artist.slug}/?${exploreQuery}`,
      action: "先查看这位艺人的作品档案",
    };
  }
  if (choice.source.kind === "PRIMARY_GENRE") return {
    label: getTaxonomyLabel(choice.source.key),
    kindLabel: "核心流派专题",
    href: `/genres/core/${choice.source.key}/?${exploreQuery}`,
    action: "先查看这一核心流派专题",
  };
  if (choice.source.kind === "SECONDARY_GENRE") return {
    label: getTaxonomyLabel(choice.source.key),
    kindLabel: "相关流派专题",
    href: `/genres/related/${choice.source.key}/?${exploreQuery}`,
    action: "先查看这一相关流派专题",
  };
  if (choice.source.kind === "ERA") return {
    label: choice.source.key.replace("s", " 年代"),
    kindLabel: "目录年代筛选",
    href: `/discover?decade=${encodeURIComponent(choice.source.key)}&${exploreQuery}`,
    action: "先查看这一年代的目录结果",
  };
  if (choice.source.kind === "LISTENING_CONTEXT") return {
    label: getListeningSceneLabel(choice.source.key),
    kindLabel: "本站聆听情境",
    href: `/scenes/${choice.source.key}/?${exploreQuery}`,
    action: "先查看这一聆听情境",
  };
  return null;
}

function explanationCopy(
  choice: ExploreRelationChoice,
  explanation: NonNullable<ReturnType<typeof buildExploreEntry>["explanation"]>,
  targetTitle: string,
) {
  if (explanation.key === "discovery.artist.escape") {
    const supporting = getDiscoveryExplanationCopy(explanation.supportingExplanation);
    return {
      lens: `艺人档案出口 · ${supporting.lens}`,
      explanation: `从${choice.label}的作品档案进入；${supporting.explanation}`,
    };
  }
  if (explanation.key === "discovery.topic.to_album") {
    return {
      lens: choice.source.kind === "ERA"
        ? "年代馆藏入口"
        : choice.source.kind === "LISTENING_CONTEXT"
          ? "聆听情境入口"
          : "流派馆藏入口",
      explanation: `从“${choice.label.replace(/^(核心流派|相关流派) · /, "")}”的真实馆藏成员《${targetTitle}》进入，再沿专辑页中的可说明关系继续。`,
    };
  }
  return getDiscoveryExplanationCopy(explanation);
}

function topicAlternates(choice: ExploreRelationChoice) {
  const kind = topicKind(choice.source);
  if (!kind) return [];
  const presentation = buildTopicDiscoveryPresentation(kind, choice.source.key, exploreContext);
  return presentation?.alternates.map((option): ExplorePresentationOption => Object.freeze({
    target: option.target,
    href: option.href,
    lens: option.lens,
    explanation: option.explanation,
    explanationKey: option.explanationKey,
    relationFamily: null,
  })) ?? [];
}

export function buildExploreRelationPresentation(
  choice: ExploreRelationChoice,
): ExploreRelationPresentation | null {
  const result = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
    mode: "RELATION_ENTRY",
    source: choice.source,
  });
  if (result.status !== "FOUND" || !result.target || !result.explanation) return null;
  const target = getAlbumDiscoveryTarget(result.target.albumId);
  const source = sourcePresentation(choice);
  if (!target || !source) return null;
  const copy = explanationCopy(choice, result.explanation, target.title);
  const primary: ExplorePresentationOption = Object.freeze({
    target,
    href: result.target.href,
    lens: copy.lens,
    explanation: copy.explanation,
    explanationKey: result.explanation.key,
    relationFamily: result.relation,
  });
  const engineAlternates = result.continuation?.status === "FOUND"
    ? result.continuation.alternates.flatMap((candidate): ExplorePresentationOption[] => {
      const option = buildAlbumDiscoveryOption(candidate);
      return option ? [Object.freeze({
        ...option,
        relationFamily: candidate.primaryRelation,
      })] : [];
    })
    : [];
  const candidates = topicKind(choice.source) ? topicAlternates(choice) : engineAlternates;
  const alternates = candidates.filter((option, index, values) =>
    option.target.id !== primary.target.id
    && values.findIndex((candidate) => candidate.target.id === option.target.id) === index)
    .slice(0, 3);
  return Object.freeze({
    authority: "RELATION",
    choice,
    sourceLabel: source.label,
    sourceKindLabel: source.kindLabel,
    sourceHref: source.href,
    sourceAction: source.action,
    primary,
    alternates: Object.freeze(alternates),
    pathContext: exploreQuery,
  });
}

export function buildExploreRandomPresentation(
  seed: string,
  dismissedAlbumIds: readonly string[] = [],
): ExploreRandomPresentation | null {
  const result = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
    mode: "RANDOM_ENTRY",
    seed,
    dismissedAlbumIds,
  });
  if (result.status !== "FOUND" || !result.target) return null;
  const target = getAlbumDiscoveryTarget(result.target.albumId);
  if (!target) return null;
  return Object.freeze({
    authority: "SERENDIPITY",
    seed,
    target,
    href: result.target.href,
    relationFamily: null,
    explanationKey: null,
    explanation: null,
    pathContext: exploreQuery,
  });
}
