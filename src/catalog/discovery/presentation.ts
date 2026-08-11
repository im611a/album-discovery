import { getListeningSceneLabel } from "../listening-scenes";
import { catalogAlbums, getTaxonomyLabel, publishedArtists } from "../published-catalog";
import { RELEASE_TYPE_LABELS, type PublishedCover, type ReleaseType } from "../schema";
import { discoverFromAlbum, type DiscoveryCandidate } from "./candidate-engine";
import type { DiscoveryExplanation } from "./explanations";
import {
  EMPTY_DISCOVERY_PATH_CONTEXT,
  parseDiscoveryPathContext,
  serializeDiscoveryPathContext,
  type DiscoveryPathContext,
} from "./path-context";
import { publishedDiscoveryIndex } from "./published-index";

export interface AlbumDiscoveryTarget {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly artists: readonly { readonly id: string; readonly name: string }[];
  readonly releaseYear: number | null;
  readonly releaseType: ReleaseType;
  readonly releaseTypeLabel: string;
  readonly cover: PublishedCover;
  readonly coreGenres: readonly string[];
}

export interface AlbumDiscoveryOption {
  readonly target: AlbumDiscoveryTarget;
  readonly href: string;
  readonly lens: string;
  readonly explanation: string;
  readonly explanationKey: DiscoveryExplanation["key"];
}

export interface AlbumDiscoveryPresentation {
  readonly source: { readonly id: string; readonly slug: string; readonly title: string };
  readonly primary: AlbumDiscoveryOption | null;
  readonly alternates: readonly AlbumDiscoveryOption[];
  readonly path: {
    readonly active: boolean;
    readonly entryLabel: string | null;
    readonly previousAlbumTitle: string | null;
    readonly resetHref: string;
  };
}

const albumById = new Map(catalogAlbums.map((album) => [album.id, album] as const));
const albumBySlug = new Map(catalogAlbums.map((album) => [album.slug, album] as const));
const artistNameById = new Map(
  catalogAlbums.flatMap((album) => album.artists.map((artist) => [artist.id, artist.name] as const)),
);

function stringList(record: DiscoveryExplanation["evidence"] | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value as readonly string[] : [];
}

function scalar(record: DiscoveryExplanation["evidence"] | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function joined(values: readonly string[], map: (value: string) => string) {
  return values.map(map).join("、");
}

function eraLabel(value: string | null | undefined) {
  return value?.endsWith("s") ? `${value.slice(0, -1)}年代` : value ?? "年代暂缺";
}

export function getDiscoveryExplanationCopy(explanation: DiscoveryExplanation) {
  const evidence = explanation.evidence;
  const contrast = explanation.contrast;
  const genres = joined(stringList(evidence, "primaryGenres"), getTaxonomyLabel);
  const contexts = joined(
    stringList(evidence, "listeningContexts").length
      ? stringList(evidence, "listeningContexts")
      : stringList(evidence, "sharedListeningContexts"),
    getListeningSceneLabel,
  );
  const artists = joined(stringList(evidence, "artistIds"), (id) => artistNameById.get(id) ?? "署名艺人");
  const sourceEra = eraLabel(scalar(evidence, "sourceEra"));
  const targetEra = eraLabel(scalar(evidence, "targetEra"));

  switch (explanation.key) {
    case "discovery.secondary.shared": {
      const secondary = joined(stringList(evidence, "secondaryGenres"), getTaxonomyLabel);
      const contrastSource = eraLabel(scalar(contrast, "sourceEra"));
      const contrastTarget = eraLabel(scalar(contrast, "targetEra"));
      return {
        lens: "相关流派线索",
        explanation: scalar(contrast, "sourceEra") && scalar(contrast, "targetEra")
          ? `两张专辑都带有“${secondary}”这一相关流派线索，并跨越${contrastSource}与${contrastTarget}。`
          : `两张专辑都带有“${secondary}”这一经人工核验的相关流派线索。`,
      };
    }
    case "discovery.artist.later":
      return {
        lens: "创作者时间线",
        explanation: `沿着${artists}的作品时间线，继续到 ${scalar(evidence, "targetYear")} 年的后一张相邻发行。`,
      };
    case "discovery.artist.earlier":
      return {
        lens: "创作者时间线",
        explanation: `沿着${artists}的作品时间线，回到 ${scalar(evidence, "targetYear")} 年的前一张相邻发行。`,
      };
    case "discovery.artist.shared_credit":
      return {
        lens: "共同创作者",
        explanation: `两张专辑共享${artists}的创作者署名。`,
      };
    case "discovery.primary.adjacent_era":
      return {
        lens: "核心流派 · 相邻年代",
        explanation: `延续“${genres}”这一核心流派，从${sourceEra}跨到相邻的${targetEra}。`,
      };
    case "discovery.primary.different_era": {
      const sharedContexts = joined(stringList(contrast, "sharedListeningContexts"), getListeningSceneLabel);
      return {
        lens: "核心流派 · 跨年代",
        explanation: `延续“${genres}”这一核心流派，从${sourceEra}转向${targetEra}${sharedContexts ? `，同时保留“${sharedContexts}”的聆听场景` : ""}。`,
      };
    }
    case "discovery.primary.same_era": {
      const sameEra = eraLabel(scalar(evidence, "era"));
      const sharedContexts = joined(stringList(evidence, "sharedListeningContexts"), getListeningSceneLabel);
      return {
        lens: "核心流派 · 同年代",
        explanation: `同属“${genres}”这一核心流派，并处在${sameEra}${sharedContexts ? `，也都适合“${sharedContexts}”` : ""}。`,
      };
    }
    case "discovery.context.genre_bridge": {
      const sourceGenres = joined(stringList(evidence, "sourcePrimaryGenres"), getTaxonomyLabel);
      const targetGenres = joined(stringList(evidence, "targetPrimaryGenres"), getTaxonomyLabel);
      return {
        lens: "聆听场景 · 流派转向",
        explanation: `都适合“${contexts}”，同时从“${sourceGenres}”转向“${targetGenres}”。`,
      };
    }
    case "discovery.context.era_bridge":
      return {
        lens: "聆听场景 · 年代线索",
        explanation: `都适合“${contexts}”，并连接${sourceEra}与${targetEra}的聆听线索。`,
      };
    case "discovery.era.adjacent":
      return {
        lens: "相邻年代",
        explanation: `从${sourceEra}继续到相邻的${targetEra}。`,
      };
    case "discovery.era.same":
      return {
        lens: "同年代",
        explanation: `两张专辑都处在${eraLabel(scalar(evidence, "era"))}，可从不同作品继续观察这一时期。`,
      };
  }
}

export function getDiscoveryEntryLabel(context: DiscoveryPathContext) {
  const key = context.entryKey;
  if (context.entryKind === "album" && key) return albumBySlug.get(key)?.title ?? null;
  if (context.entryKind === "artist" && key) {
    return publishedArtists.find((artist) => artist.slug === key || artist.artistId === key)?.name ?? null;
  }
  if (context.entryKind === "primary-genre" || context.entryKind === "secondary-genre") {
    return key ? getTaxonomyLabel(key) : null;
  }
  if (context.entryKind === "listening-context") return key ? getListeningSceneLabel(key) : null;
  if (context.entryKind === "era") return eraLabel(key);
  if (context.entryKind === "explore") return "随手探索";
  if (context.entryKind === "search") return "搜索";
  if (context.entryKind === "discover") return "发现目录";
  return null;
}

export function getAlbumDiscoveryTarget(albumId: string): AlbumDiscoveryTarget | null {
  const target = albumById.get(albumId);
  if (!target) return null;
  return Object.freeze({
    id: target.id,
    slug: target.slug,
    title: target.title,
    artists: Object.freeze(target.artists.map((artist) => Object.freeze({ id: artist.id, name: artist.name }))),
    releaseYear: target.releaseYear,
    releaseType: target.albumType,
    releaseTypeLabel: RELEASE_TYPE_LABELS[target.albumType],
    cover: target.cover,
    coreGenres: Object.freeze([...target.coreGenres]),
  });
}

export function buildAlbumDiscoveryOption(candidate: DiscoveryCandidate): AlbumDiscoveryOption | null {
  const target = getAlbumDiscoveryTarget(candidate.targetAlbumId);
  if (!target) return null;
  const copy = getDiscoveryExplanationCopy(candidate.explanation);
  const query = serializeDiscoveryPathContext(candidate.nextPathContext);
  return Object.freeze({
    target,
    href: query ? `/albums/${target.slug}?${query}` : `/albums/${target.slug}/`,
    lens: copy.lens,
    explanation: copy.explanation,
    explanationKey: candidate.explanation.key,
  });
}

function withAlbumEntry(sourceSlug: string, context: DiscoveryPathContext) {
  if (context.entryKind) return context;
  return Object.freeze({
    entryKind: "album" as const,
    entryKey: sourceSlug,
    trailAlbumSlugs: context.trailAlbumSlugs,
    transitionFamilies: context.transitionFamilies,
  });
}

export function buildAlbumDiscoveryPresentation(
  sourceAlbumId: string,
  context: DiscoveryPathContext = EMPTY_DISCOVERY_PATH_CONTEXT,
): AlbumDiscoveryPresentation | null {
  const source = albumById.get(sourceAlbumId);
  if (!source) return null;
  const normalized = parseDiscoveryPathContext(
    serializeDiscoveryPathContext(context),
    publishedDiscoveryIndex,
  );
  const result = discoverFromAlbum(
    publishedDiscoveryIndex,
    sourceAlbumId,
    withAlbumEntry(source.slug, normalized),
  );
  if (result.status !== "FOUND") return null;
  const primary = result.primary ? buildAlbumDiscoveryOption(result.primary) : null;
  const alternates = result.alternates
    .map(buildAlbumDiscoveryOption)
    .filter((option): option is AlbumDiscoveryOption => option != null);
  const previousSlug = normalized.trailAlbumSlugs.at(-1);
  return Object.freeze({
    source: Object.freeze({ id: source.id, slug: source.slug, title: source.title }),
    primary,
    alternates: Object.freeze(alternates),
    path: Object.freeze({
      active: Boolean(
        normalized.entryKind
        || normalized.trailAlbumSlugs.length
        || normalized.transitionFamilies.length,
      ),
      entryLabel: getDiscoveryEntryLabel(normalized),
      previousAlbumTitle: previousSlug ? albumBySlug.get(previousSlug)?.title ?? null : null,
      resetHref: `/albums/${source.slug}/`,
    }),
  });
}

export function buildAlbumDiscoveryPresentationFromSearchParams(
  sourceAlbumId: string,
  searchParams: string | URLSearchParams,
) {
  return buildAlbumDiscoveryPresentation(
    sourceAlbumId,
    parseDiscoveryPathContext(searchParams, publishedDiscoveryIndex),
  );
}
