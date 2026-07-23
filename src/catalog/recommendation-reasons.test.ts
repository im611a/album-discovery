import { describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { catalogAlbums } from "./published-catalog";
import { recommendAlbums, RECOMMENDATION_WEIGHTS } from "./recommendation";

describe("recommendation explanations", () => {
  it("keeps every scoring weight in the exported central table", () => {
    expect(Object.keys(RECOMMENDATION_WEIGHTS).sort()).toEqual(["coldStart", "context", "coreGenre", "descriptor", "editorial", "era", "exploration", "favoriteSimilarity", "negativeSimilarity", "relatedGenre", "savedSimilarity"].sort());
  });

  it("uses the Chinese taxonomy label instead of leaking an internal genre key", () => {
    const state = { ...createInitialUserState(), onboardingCompleted: true, taste: { ...createInitialUserState().taste, genres: ["art-pop"] } };
    const reasons = recommendAlbums(state, 8).flatMap((item) => item.reasons);
    expect(reasons.some((reason) => reason.includes("艺术流行"))).toBe(true);
    expect(reasons.every((reason) => !reason.includes("art-pop"))).toBe(true);
  });

  it("only states favorite similarity when a favorite actually contributes", () => {
    const seed = catalogAlbums.find((album) => album.slug === "fantasy-jay-chou")!;
    const state = { ...createInitialUserState(), onboardingCompleted: true, favoriteAlbumIds: [seed.id] };
    const explained = recommendAlbums(state).filter((item) => item.reasons.some((reason) => reason.includes("已喜欢")));
    expect(explained.length).toBeGreaterThan(0);
    for (const item of explained) {
      expect(item.album.coreGenres.some((value) => seed.coreGenres.includes(value))).toBe(true);
    }
  });

  it("never emits unsupported popularity or AI claims", () => {
    const text = recommendAlbums(createInitialUserState()).flatMap((item) => item.reasons).join(" ");
    expect(text).not.toMatch(/AI 推荐|评分很高|很火|热度/);
  });
  it("gives every cold-start recommendation an explicit policy reason", () => expect(recommendAlbums(createInitialUserState()).every((item) => item.reasons.length > 0)).toBe(true));
});
