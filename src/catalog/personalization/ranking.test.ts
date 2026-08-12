import { describe, expect, it } from "vitest";
import { catalogAlbums } from "../published-catalog";
import { explanationClaim } from "./explanations";
import { rankPersonalAlbums } from "./ranking";

const seed = catalogAlbums.find((album) => album.coreGenres.length && album.contexts.length) ?? catalogAlbums[0];
const state = {
  taste: { genres: seed.coreGenres, contexts: seed.contexts, eras: [], seedAlbumIds: [seed.id], exploration: "balanced" },
  likedAlbumIds: [seed.id],
  favoriteAlbumIds: [],
  savedAlbumIds: [],
  listenedAlbumIds: [],
  dismissedAlbumIds: [],
  recentAlbumIds: [],
  onboardingCompleted: true,
};

describe("R14 deterministic personal ranking", () => {
  it("retains personal evidence and deterministic tier ordering", () => {
    const first = rankPersonalAlbums({ state, catalog: catalogAlbums, context: "FOR_YOU", limit: 12 });
    const replay = rankPersonalAlbums({ state, catalog: catalogAlbums, context: "FOR_YOU", limit: 12 });
    expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
    expect(first.candidates.length).toBeGreaterThan(0);
    expect(first.candidates.every((item) => item.provenance === "PERSONAL" && item.evidence.length > 0)).toBe(true);
    expect(first.candidates.flatMap((item) => item.explanations).every((item) => item.evidence != null)).toBe(true);
  });

  it("keeps relation fallback explicitly non-personal", () => {
    const fallback = catalogAlbums.slice(0, 5).map((album) => album.id);
    const result = rankPersonalAlbums({ state: {}, catalog: catalogAlbums, context: "EXPLORE", limit: 5, relationFallbackAlbumIds: [...fallback, fallback[0]] });
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates.every((item) => item.provenance === "RELATION_FALLBACK" && item.evidence.length === 0 && item.tier === "RELATION_FALLBACK")).toBe(true);
    expect(result.candidates.every((item) => explanationClaim(item.explanations[0]).includes("不属于个性化"))).toBe(true);
    expect(rankPersonalAlbums({ state: {}, catalog: catalogAlbums, context: "EXPLORE", limit: 0, relationFallbackAlbumIds: fallback }).candidates).toEqual([]);
  });

  it("excludes explicit holdings, negatives, and the current path", () => {
    const first = rankPersonalAlbums({ state, catalog: catalogAlbums, context: "ALBUM", limit: 4 });
    const visited = first.candidates.map((item) => item.album.id);
    const next = rankPersonalAlbums({ state: { ...state, dismissedAlbumIds: [visited[0]] }, catalog: catalogAlbums, context: "ALBUM", limit: 8, path: { visitedAlbumIds: visited, step: 4 } });
    expect(next.candidates.some((item) => visited.includes(item.album.id))).toBe(false);
    expect(next.excludedAlbumIds).toEqual(expect.arrayContaining([seed.id, ...visited]));
  });

  it("applies first-pass artist, genre, and era bounds", () => {
    const result = rankPersonalAlbums({ state, catalog: catalogAlbums, context: "HOME", limit: 12 });
    const strict = result.candidates.filter((item) => !item.diversityRelaxed);
    const count = (values: string[]) => values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {});
    expect(Math.max(...Object.values(count(strict.map((item) => item.album.artists[0]?.id ?? "unknown"))))).toBeLessThanOrEqual(1);
    expect(Math.max(...Object.values(count(strict.map((item) => item.album.coreGenres[0] ?? "unknown"))))).toBeLessThanOrEqual(3);
    expect(Math.max(...Object.values(count(strict.map((item) => item.album.releaseYear == null ? "unknown" : `${Math.floor(item.album.releaseYear / 10) * 10}s`))))).toBeLessThanOrEqual(4);
  });

  it("uses truthful viewed and marked-listened vocabulary", () => {
    const recentState = { ...state, taste: { ...state.taste, genres: [], contexts: [], seedAlbumIds: [] }, likedAlbumIds: [], recentAlbumIds: [seed.id] };
    const viewed = rankPersonalAlbums({ state: recentState, catalog: catalogAlbums, context: "FOR_YOU", limit: 1 }).candidates[0];
    expect(viewed).toBeDefined();
    expect(viewed.explanations.map(explanationClaim).join(" ")).toContain("查看");
    expect(viewed.explanations.map(explanationClaim).join(" ")).not.toContain("你听过");
  });
});
