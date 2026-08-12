import type { PublishedAlbumSummary } from "../schema";
import { advancePersonalizationPath } from "./normalize";
import { rankPersonalAlbums } from "./ranking";
import type { PersonalizationContext, PersonalizationPathContext } from "./types";

export const R14_SIMULATION_FIXTURES = ["EMPTY", "MINIMAL", "RECENT_HEAVY", "ARTIST_HEAVY", "GENRE_HEAVY", "ERA_HEAVY", "SAVED_HEAVY", "EXPLORATION_HEAVY", "MIXED", "MALFORMED_RECOVERABLE"] as const;
type FixtureName = (typeof R14_SIMULATION_FIXTURES)[number];

function fixture(name: FixtureName, catalog: readonly PublishedAlbumSummary[]): unknown {
  const first = catalog.find((album) => album.coreGenres.length && album.contexts.length) ?? catalog[0];
  const albums = catalog.slice(0, 30);
  const genre = first.coreGenres[0];
  const context = first.contexts[0];
  const era = first.releaseYear == null ? "unknown" : `${Math.floor(first.releaseYear / 10) * 10}s`;
  const base = { taste: { genres: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" }, likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], onboardingCompleted: true };
  if (name === "EMPTY") return {};
  if (name === "MINIMAL") return { ...base, taste: { ...base.taste, genres: [genre] } };
  if (name === "RECENT_HEAVY") return { ...base, recentAlbumIds: albums.slice(0, 20).map((album) => album.id) };
  if (name === "ARTIST_HEAVY") return { ...base, likedAlbumIds: albums.slice(0, 12).map((album) => album.id) };
  if (name === "GENRE_HEAVY") return { ...base, taste: { ...base.taste, genres: [genre] } };
  if (name === "ERA_HEAVY") return { ...base, taste: { ...base.taste, eras: [era] } };
  if (name === "SAVED_HEAVY") return { ...base, savedAlbumIds: albums.slice(0, 20).map((album) => album.id) };
  if (name === "EXPLORATION_HEAVY") return { ...base, taste: { ...base.taste, contexts: [context], exploration: "exploratory" } };
  if (name === "MIXED") return { ...base, taste: { ...base.taste, genres: [genre], contexts: [context], eras: [era], seedAlbumIds: [albums[0].id] }, likedAlbumIds: [albums[1].id], favoriteAlbumIds: [albums[2].id], savedAlbumIds: [albums[3].id], listenedAlbumIds: [albums[4].id], recentAlbumIds: albums.slice(5, 15).map((album) => album.id), dismissedAlbumIds: [albums[15].id] };
  return { taste: { genres: [genre, 7], contexts: null, eras: [era], seedAlbumIds: [albums[0].id, "missing"], exploration: "unexpected" }, likedAlbumIds: "bad", favoriteAlbumIds: [albums[1].id], recentAlbumIds: [...albums.map((album) => album.id), albums[0].id], recommendationFeedback: { [albums[2].id]: "like", missing: "not_for_me", bad: "unknown" } };
}

export interface R14SimulationReport {
  readonly fixtureClasses: number;
  readonly decisions: number;
  readonly transitions: number;
  readonly invalidTargets: number;
  readonly unresolvedTargets: number;
  readonly duplicateCandidates: number;
  readonly avoidableShortLoops: number;
  readonly sameArtistSaturation: number;
  readonly sameGenreSaturation: number;
  readonly sameEraSaturation: number;
  readonly falsePersonalization: number;
  readonly relationMislabeledPersonal: number;
  readonly randomMislabeledPersonal: number;
  readonly explanationMismatch: number;
  readonly determinismFailure: number;
}

export function runR14PersonalizationSimulation(catalog: readonly PublishedAlbumSummary[], decisionsPerFixture = 2_000, transitionsPerFixture = 500): R14SimulationReport {
  const ids = new Set(catalog.map((album) => album.id));
  const fallback = catalog.slice(0, 40).map((album) => album.id);
  const contexts: PersonalizationContext[] = ["HOME", "FOR_YOU", "ALBUM", "ARTIST", "EXPLORE"];
  const failures = { invalidTargets: 0, unresolvedTargets: 0, duplicateCandidates: 0, avoidableShortLoops: 0, sameArtistSaturation: 0, sameGenreSaturation: 0, sameEraSaturation: 0, falsePersonalization: 0, relationMislabeledPersonal: 0, randomMislabeledPersonal: 0, explanationMismatch: 0, determinismFailure: 0 };
  const audit = (result: ReturnType<typeof rankPersonalAlbums>, recentPath: readonly string[]) => {
    const resultIds = result.candidates.map((item) => item.album.id);
    failures.invalidTargets += resultIds.filter((id) => !ids.has(id)).length;
    failures.unresolvedTargets += result.candidates.filter((item) => !item.album.slug).length;
    if (new Set(resultIds).size !== resultIds.length) failures.duplicateCandidates += 1;
    if (resultIds[0] && recentPath.slice(-6).includes(resultIds[0])) failures.avoidableShortLoops += 1;
    const strict = result.candidates.filter((item) => !item.diversityRelaxed);
    const maxCount = (values: string[]) => Math.max(0, ...Object.values(values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {})));
    if (maxCount(strict.map((item) => item.album.artists[0]?.id ?? "unknown")) > 1) failures.sameArtistSaturation += 1;
    if (maxCount(strict.map((item) => item.album.coreGenres[0] ?? "unknown")) > 3) failures.sameGenreSaturation += 1;
    if (maxCount(strict.map((item) => item.album.releaseYear == null ? "unknown" : `${Math.floor(item.album.releaseYear / 10) * 10}s`)) > 4) failures.sameEraSaturation += 1;
    failures.falsePersonalization += result.candidates.filter((item) => item.provenance === "PERSONAL" && item.evidence.length === 0).length;
    failures.relationMislabeledPersonal += result.candidates.filter((item) => item.provenance === "RELATION_FALLBACK" && (item.evidence.length > 0 || item.explanations.some((explanation) => explanation.key.startsWith("personal.")))).length;
    failures.randomMislabeledPersonal += result.candidates.filter((item) => (item.provenance as string) === "RANDOM").length;
    failures.explanationMismatch += result.candidates.filter((item) => item.provenance === "PERSONAL" && item.explanations.some((explanation) => !explanation.evidence || !item.evidence.includes(explanation.evidence))).length;
  };
  const signature = (result: ReturnType<typeof rankPersonalAlbums>) => JSON.stringify({
    context: result.context,
    candidates: result.candidates.map((item) => ({ id: item.album.id, provenance: item.provenance, tier: item.tier, evidence: item.evidence, diversityRelaxed: item.diversityRelaxed })),
    excludedAlbumIds: result.excludedAlbumIds,
  });
  for (const [fixtureIndex, name] of R14_SIMULATION_FIXTURES.entries()) {
    const state = fixture(name, catalog);
    for (let index = 0; index < Math.floor(decisionsPerFixture / 2); index += 1) {
      const pathIds = catalog.slice((index + fixtureIndex) % Math.max(1, catalog.length - 12), (index + fixtureIndex) % Math.max(1, catalog.length - 12) + index % 13).map((album) => album.id);
      const input = { state, catalog, context: contexts[index % contexts.length], limit: 12, path: { visitedAlbumIds: pathIds, step: index }, relationFallbackAlbumIds: fallback } as const;
      const result = rankPersonalAlbums(input);
      const replay = rankPersonalAlbums(input);
      if (signature(result) !== signature(replay)) failures.determinismFailure += 1;
      audit(result, pathIds);
      audit(replay, pathIds);
    }
    if (decisionsPerFixture % 2) audit(rankPersonalAlbums({ state, catalog, context: "FOR_YOU", limit: 12, relationFallbackAlbumIds: fallback }), []);
    let path: PersonalizationPathContext = { visitedAlbumIds: [], step: 0 };
    for (let index = 0; index < transitionsPerFixture; index += 1) {
      const result = rankPersonalAlbums({ state, catalog, context: contexts[index % contexts.length], limit: 12, path, relationFallbackAlbumIds: fallback });
      audit(result, path.visitedAlbumIds);
      const target = result.candidates[index % Math.max(1, result.candidates.length)]?.album.id;
      if (target) path = advancePersonalizationPath(path, target, ids);
    }
  }
  return Object.freeze({ fixtureClasses: R14_SIMULATION_FIXTURES.length, decisions: R14_SIMULATION_FIXTURES.length * decisionsPerFixture, transitions: R14_SIMULATION_FIXTURES.length * transitionsPerFixture, ...failures });
}
