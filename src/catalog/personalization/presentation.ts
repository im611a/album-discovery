import { getListeningSceneLabel } from "../listening-scenes";
import { catalogAlbums, getTaxonomyLabel } from "../published-catalog";
import type { PublishedAlbumSummary } from "../schema";
import { getAlbumRelationEvidence } from "../discovery/relation-index";
import { buildAlbumDiscoveryPresentation } from "../discovery/presentation";
import { publishedDiscoveryIndex } from "../discovery/published-index";
import { buildPersonalJourneyAlbumHref, parsePersonalJourneyUrlContext, type PersonalJourneySource } from "./path-context";
import { rankPersonalAlbums } from "./ranking";
import type { PersonalCandidate, PersonalEvidence, PersonalEvidenceFamily, PersonalizationContext, PersonalizationProvenance } from "./types";

export interface PersonalJourneyOption {
  readonly album: PublishedAlbumSummary;
  readonly href: string;
  readonly provenance: PersonalizationProvenance;
  readonly lens: string;
  readonly explanationKey: string;
  readonly explanation: string;
  readonly sourceEvidenceIds: readonly string[];
}

export interface PersonalJourneyPresentation {
  readonly status: "EMPTY" | "READY";
  readonly context: PersonalizationContext;
  readonly summary: string;
  readonly primary: PersonalJourneyOption | null;
  readonly secondary: readonly PersonalJourneyOption[];
  readonly fallback: readonly PersonalJourneyOption[];
  readonly ctas: readonly { readonly href: string; readonly label: string }[];
}

const albumById = new Map(catalogAlbums.map((album) => [album.id, album] as const));
const albumIdBySlug = new Map(catalogAlbums.map((album) => [album.slug, album.id] as const));
const FAMILY_ORDER: readonly PersonalEvidenceFamily[] = [
  "LIKED_ALBUM_BRIDGE", "FAVORITE_ALBUM_BRIDGE", "SEED_ALBUM_BRIDGE",
  "TASTE_GENRE", "TASTE_CONTEXT", "TASTE_ERA",
  "SAVED_ALBUM_BRIDGE", "MARKED_LISTENED_BRIDGE", "RECENT_VIEW_BRIDGE",
];

function evidenceCopy(evidence: PersonalEvidence) {
  const source = evidence.sourceAlbumId ? albumById.get(evidence.sourceAlbumId) : null;
  const sourceTitle = source ? `《${source.title}》` : "你明确选择的口味";
  const matchedLabel = /^\d{4}s$/.test(evidence.matchedValue)
    ? evidence.matchedValue.replace("s", " 年代")
    : source?.contexts.includes(evidence.matchedValue)
      ? getListeningSceneLabel(evidence.matchedValue)
      : getTaxonomyLabel(evidence.matchedValue);
  if (evidence.family === "TASTE_GENRE") return { lens: "明确口味 · 核心流派", explanation: `与你明确选择的“${matchedLabel}”方向重合。` };
  if (evidence.family === "TASTE_CONTEXT") return { lens: "明确口味 · 聆听场景", explanation: `与你选择的“${getListeningSceneLabel(evidence.matchedValue)}”场景重合。` };
  if (evidence.family === "TASTE_ERA") return { lens: "明确口味 · 年代", explanation: `来自你明确选择的 ${evidence.matchedValue.replace("s", " 年代")}。` };
  if (evidence.family === "LIKED_ALBUM_BRIDGE") return { lens: "从喜欢的作品继续", explanation: `与标记喜欢的${sourceTitle}在“${matchedLabel}”线索上重合。` };
  if (evidence.family === "FAVORITE_ALBUM_BRIDGE") return { lens: "从收藏继续", explanation: `与收藏的${sourceTitle}在“${matchedLabel}”线索上重合。` };
  if (evidence.family === "SEED_ALBUM_BRIDGE") return { lens: "从明确选择继续", explanation: `与主动选择的${sourceTitle}在“${matchedLabel}”线索上重合。` };
  if (evidence.family === "SAVED_ALBUM_BRIDGE") return { lens: "从已保存作品继续", explanation: `与已保存的${sourceTitle}在“${matchedLabel}”线索上重合。` };
  if (evidence.family === "MARKED_LISTENED_BRIDGE") return { lens: "从标记已听继续", explanation: `与标记为已听的${sourceTitle}在“${matchedLabel}”线索上重合。` };
  return { lens: "沿最近查看的路径继续", explanation: `从最近查看的${sourceTitle}沿“${matchedLabel}”线索继续。` };
}

function strongestEvidence(candidate: PersonalCandidate) {
  return [...candidate.evidence].sort((left, right) => FAMILY_ORDER.indexOf(left.family) - FAMILY_ORDER.indexOf(right.family))[0] ?? null;
}

function summaryFor(result: ReturnType<typeof rankPersonalAlbums>) {
  const state = result.normalizedState;
  const details = [
    state.recentAlbumIds.length ? `${state.recentAlbumIds.length} 张最近查看` : null,
    state.savedAlbumIds.length ? `${state.savedAlbumIds.length} 张已保存` : null,
    state.favoriteAlbumIds.length ? `${state.favoriteAlbumIds.length} 张收藏` : null,
    state.likedAlbumIds.length ? `${state.likedAlbumIds.length} 张喜欢` : null,
    state.listenedAlbumIds.length ? `${state.listenedAlbumIds.length} 张标记已听` : null,
  ].filter((item): item is string => Boolean(item));
  if (details.length) return `从当前设备上的${details.slice(0, 3).join("、")}继续。`;
  if (state.taste.genres.length || state.taste.contexts.length || state.taste.eras.length) return "从你明确选择的本机口味线索继续。";
  return "个人路径只会在你查看、保存或标记作品后形成。";
}

function optionFor(candidate: PersonalCandidate, input: BuildPersonalJourneyPresentationInput): PersonalJourneyOption {
  const evidence = strongestEvidence(candidate);
  const copy = evidence ? evidenceCopy(evidence) : { lens: "相关路径", explanation: "沿当前作品的可说明关系继续；这不是个人偏好结论。" };
  return Object.freeze({
    album: candidate.album,
    href: buildPersonalJourneyAlbumHref({ targetSlug: candidate.album.slug, source: input.source, currentAlbumSlug: input.currentAlbumSlug, searchParams: input.searchParams, catalog: catalogAlbums }),
    provenance: candidate.provenance,
    lens: copy.lens,
    explanationKey: evidence ? `personal.${evidence.family.toLowerCase()}` : "relation.fallback",
    explanation: copy.explanation,
    sourceEvidenceIds: Object.freeze(evidence?.sourceAlbumId ? [evidence.sourceAlbumId] : []),
  });
}

export interface BuildPersonalJourneyPresentationInput {
  readonly state: unknown;
  readonly context: PersonalizationContext;
  readonly source: PersonalJourneySource;
  readonly limit?: number;
  readonly searchParams?: string | URLSearchParams;
  readonly currentAlbumSlug?: string;
  readonly currentAlbumIds?: readonly string[];
  readonly eligibleAlbumIds?: readonly string[];
  readonly excludedAlbumIds?: readonly string[];
  readonly relationFallbackAlbumIds?: readonly string[];
}

export function buildPersonalJourneyPresentation(input: BuildPersonalJourneyPresentationInput): PersonalJourneyPresentation {
  const urlPath = parsePersonalJourneyUrlContext(input.searchParams ?? "", catalogAlbums);
  const pathIds = urlPath.trailAlbumSlugs.map((slug) => albumIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
  const result = rankPersonalAlbums({
    state: input.state,
    catalog: catalogAlbums,
    context: input.context,
    limit: input.limit ?? 8,
    path: { visitedAlbumIds: pathIds, step: pathIds.length },
    relationFallbackAlbumIds: input.relationFallbackAlbumIds,
    eligibleAlbumIds: input.eligibleAlbumIds,
    excludedAlbumIds: [...(input.currentAlbumIds ?? []), ...(input.excludedAlbumIds ?? [])],
  });
  const options = result.candidates.map((candidate) => optionFor(candidate, input));
  const personal = options.filter((option) => option.provenance === "PERSONAL");
  const fallback = options.filter((option) => option.provenance === "RELATION_FALLBACK");
  const primary = personal[0] ?? fallback[0] ?? null;
  const secondary = personal.slice(primary?.provenance === "PERSONAL" ? 1 : 0, 6);
  const fallbackOptions = fallback.filter((option) => option.album.id !== primary?.album.id).slice(0, 3);
  return Object.freeze({
    status: primary ? "READY" : "EMPTY",
    context: input.context,
    summary: summaryFor(result),
    primary,
    secondary: Object.freeze(secondary),
    fallback: Object.freeze(fallbackOptions),
    ctas: Object.freeze([
      Object.freeze({ href: "/discover", label: "浏览专辑档案" }),
      Object.freeze({ href: "/explore", label: "进入探索路径" }),
      Object.freeze({ href: "/settings#taste", label: "设置本机口味" }),
    ]),
  });
}

export function getRelationEligibleAlbumIds(sourceAlbumIds: readonly string[]) {
  const sources = sourceAlbumIds.filter((id) => albumById.has(id));
  return Object.freeze(catalogAlbums.filter((target) => sources.some((sourceId) => sourceId !== target.id && getAlbumRelationEvidence(publishedDiscoveryIndex, sourceId, target.id))).map((album) => album.id));
}

export function getAlbumRelationFallbackIds(sourceAlbumId: string) {
  const presentation = buildAlbumDiscoveryPresentation(sourceAlbumId);
  return Object.freeze([
    ...(presentation?.primary ? [presentation.primary.target.id] : []),
    ...(presentation?.alternates.map((option) => option.target.id) ?? []),
  ]);
}
