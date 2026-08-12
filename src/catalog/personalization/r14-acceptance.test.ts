import { describe, expect, it } from "vitest";
import { buildArtistDiscoveryPresentation } from "../discovery/artist-topic-presentation";
import { buildExploreRandomPresentation } from "../discovery/explore-entry-presentation";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import { getTopicSummaries } from "../topics";
import { buildPersonalJourneyPresentation, getAlbumRelationFallbackIds, getRelationEligibleAlbumIds } from "./presentation";

const sources = catalogAlbums.slice(0, 20);
const first = sources[0];
const genre = first.coreGenres[0];
const context = first.contexts[0];
const era = `${Math.floor((first.releaseYear ?? 2000) / 10) * 10}s`;
const base = { taste: { genres: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" }, likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], onboardingCompleted: true };
const goldenStates: readonly [string, unknown][] = [
  ["empty", {}],
  ["genre", { ...base, taste: { ...base.taste, genres: [genre] } }],
  ["context", { ...base, taste: { ...base.taste, contexts: [context] } }],
  ["era", { ...base, taste: { ...base.taste, eras: [era] } }],
  ["seed", { ...base, taste: { ...base.taste, seedAlbumIds: [sources[0].id] } }],
  ["liked", { ...base, likedAlbumIds: [sources[0].id] }],
  ["favorite", { ...base, favoriteAlbumIds: [sources[1].id] }],
  ["saved", { ...base, savedAlbumIds: [sources[2].id] }],
  ["marked-listened", { ...base, listenedAlbumIds: [sources[3].id] }],
  ["recent", { ...base, recentAlbumIds: [sources[4].id] }],
  ["negative", { ...base, dismissedAlbumIds: sources.slice(0, 8).map((album) => album.id) }],
  ["minimal", { likedAlbumIds: [sources[0].id] }],
  ["dense", { ...base, likedAlbumIds: sources.slice(0, 4).map((album) => album.id), favoriteAlbumIds: sources.slice(4, 8).map((album) => album.id), savedAlbumIds: sources.slice(8, 12).map((album) => album.id), recentAlbumIds: sources.slice(0, 20).map((album) => album.id) }],
  ["malformed", { taste: { genres: [genre, 8], contexts: null }, likedAlbumIds: "wrong", recentAlbumIds: [sources[0].id, "missing"] }],
  ["all-local-actions", { ...base, likedAlbumIds: [sources[0].id], favoriteAlbumIds: [sources[1].id], savedAlbumIds: [sources[2].id], listenedAlbumIds: [sources[3].id], recentAlbumIds: [sources[4].id] }],
  ["exploratory", { ...base, taste: { ...base.taste, genres: [genre], exploration: "exploratory" } }],
  ["bounded-path", { ...base, recentAlbumIds: sources.slice(0, 12).map((album) => album.id) }],
  ["fallback-only", {}],
];

describe("R14 18-state golden truth matrix", () => {
  it.each(goldenStates)("keeps %s deterministic and evidence-backed", (_name, state) => {
    const input = { state, context: "FOR_YOU" as const, source: "for-you" as const, relationFallbackAlbumIds: getAlbumRelationFallbackIds(first.id), limit: 8 };
    const result = buildPersonalJourneyPresentation(input);
    expect(result).toEqual(buildPersonalJourneyPresentation(input));
    for (const option of [result.primary, ...result.secondary, ...result.fallback].filter(Boolean)) {
      expect(catalogAlbums.some((album) => album.id === option!.album.id)).toBe(true);
      if (option!.provenance === "PERSONAL") expect(option!.explanationKey).toMatch(/^personal\./);
      else expect(option!.explanation).toContain("不是个人偏好结论");
    }
  });
});

describe("R14 complete catalog and serendipity audits", () => {
  it("covers every published Album, Artist and Topic without an unresolved continuation", () => {
    for (const album of catalogAlbums) {
      expect(getAlbumRelationFallbackIds(album.id).length, album.slug).toBeGreaterThan(0);
      expect(getRelationEligibleAlbumIds([album.id]).length, album.slug).toBeGreaterThan(0);
    }
    for (const artist of publishedArtists) expect(buildArtistDiscoveryPresentation(artist.artistId), artist.slug).not.toBeNull();
    const topics = ["core", "related", "scene", "decade"].flatMap((kind) => getTopicSummaries(kind as "core" | "related" | "scene" | "decade"));
    expect(topics.every((topic) => topic.count > 0 && topic.previewAlbums.length > 0)).toBe(true);
  }, 60_000);

  it("audits 20,000 deterministic random seeds without relation or personal claims", () => {
    for (let index = 0; index < 20_000; index += 1) {
      const seed = `r14-${index}`;
      const firstResult = buildExploreRandomPresentation(seed);
      const replay = buildExploreRandomPresentation(seed);
      expect(firstResult).toEqual(replay);
      expect(firstResult).toMatchObject({ authority: "SERENDIPITY", relationFamily: null, explanationKey: null, explanation: null });
    }
  }, 60_000);
});
