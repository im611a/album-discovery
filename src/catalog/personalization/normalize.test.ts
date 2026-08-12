import { describe, expect, it } from "vitest";
import { advancePersonalizationPath, normalizePersonalizationPath, normalizePersonalState } from "./normalize";

const ids = new Set(Array.from({ length: 30 }, (_, index) => `album-${index}`));

describe("R14 personal state normalization", () => {
  it("recovers malformed fields without inventing activity", () => {
    const state = normalizePersonalState({
      taste: { genres: ["rock", "rock", 4], contexts: null, eras: ["1990s"], seedAlbumIds: ["album-1", "missing"] },
      likedAlbumIds: ["album-2", "album-3"],
      dismissedAlbumIds: ["album-3"],
      recommendationFeedback: { "album-2": "like", "album-4": "not_for_me", missing: "like", bad: "unknown" },
      recentAlbumIds: [...Array.from({ length: 25 }, (_, index) => `album-${index}`), "album-2"],
      onboardingCompleted: "yes",
    }, ids);
    expect(state.taste.genres).toEqual(["rock"]);
    expect(state.taste.contexts).toEqual([]);
    expect(state.taste.seedAlbumIds).toEqual(["album-1"]);
    expect(state.likedAlbumIds).toEqual(["album-2"]);
    expect(state.dismissedAlbumIds).toEqual(["album-3", "album-4"]);
    expect(state.recentAlbumIds).toHaveLength(18);
    expect(state.recentAlbumIds).not.toEqual(expect.arrayContaining(["album-3", "album-4"]));
    expect(state.onboardingCompleted).toBe(false);
  });

  it("bounds and advances a canonical browsing path", () => {
    const path = normalizePersonalizationPath({ visitedAlbumIds: ["missing", ...Array.from({ length: 15 }, (_, index) => `album-${index}`), "album-14"], step: 8 }, ids);
    expect(path.visitedAlbumIds).toEqual(Array.from({ length: 12 }, (_, index) => `album-${index + 3}`));
    const next = advancePersonalizationPath(path, "album-16", ids);
    expect(next.step).toBe(9);
    expect(next.visitedAlbumIds.at(-1)).toBe("album-16");
    expect(next.visitedAlbumIds).toHaveLength(12);
  });
});
