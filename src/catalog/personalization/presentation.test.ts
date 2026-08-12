import { describe, expect, it } from "vitest";
import { catalogAlbums } from "../published-catalog";
import { buildPersonalJourneyPresentation, getAlbumRelationFallbackIds, getRelationEligibleAlbumIds } from "./presentation";

const seed = catalogAlbums.find((album) => album.coreGenres.length && album.contexts.length) ?? catalogAlbums[0];
const base = { taste: { genres: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" }, likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], onboardingCompleted: true };

describe("R14 centralized personal journey presentation", () => {
  const cases = [
    ["likedAlbumIds", "从喜欢的作品继续"],
    ["favoriteAlbumIds", "从收藏继续"],
    ["savedAlbumIds", "从已保存作品继续"],
    ["listenedAlbumIds", "从标记已听继续"],
    ["recentAlbumIds", "沿最近查看的路径继续"],
  ] as const;
  it.each(cases)("renders truthful %s copy", (key, lens) => {
    const result = buildPersonalJourneyPresentation({ state: { ...base, [key]: [seed.id] }, context: "FOR_YOU", source: "for-you", limit: 4 });
    expect(result.status).toBe("READY");
    expect(result.primary?.lens).toBe(lens);
    expect(result.primary?.explanation).not.toMatch(/播放|收听记录|听过很多次|最喜欢/);
  });

  it("keeps relation fallback visibly separate from personal evidence", () => {
    const result = buildPersonalJourneyPresentation({ state: {}, context: "EXPLORE", source: "explore", relationFallbackAlbumIds: catalogAlbums.slice(0, 2).map((album) => album.id) });
    expect(result.primary?.provenance).toBe("RELATION_FALLBACK");
    expect(result.primary?.explanationKey).toBe("relation.fallback");
    expect(result.primary?.explanation).toContain("不是个人偏好结论");
  });

  it("returns a useful truthful empty state without fallback", () => {
    const result = buildPersonalJourneyPresentation({ state: {}, context: "HOME", source: "home" });
    expect(result.status).toBe("EMPTY");
    expect(result.primary).toBeNull();
    expect(result.ctas.map((item) => item.href)).toEqual(["/discover", "/explore", "/settings#taste"]);
  });

  it("derives album relation eligibility and fallback from the accepted R13 graph", () => {
    const eligible = getRelationEligibleAlbumIds([seed.id]);
    const fallback = getAlbumRelationFallbackIds(seed.id);
    expect(eligible.length).toBeGreaterThan(0);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.every((id) => eligible.includes(id))).toBe(true);
  });
});
