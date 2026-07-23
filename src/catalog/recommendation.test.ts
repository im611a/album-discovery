import { describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { catalogAlbums } from "./published-catalog";
import { recommendAlbums } from "./recommendation";

describe("recommendation engine", () => {
  it("is deterministic and emits reasons from actual contributions", () => {
    const state = { ...createInitialUserState(), onboardingCompleted: true, taste: { ...createInitialUserState().taste, genres: ["ambient"], contexts: ["工作"] } };
    const first = recommendAlbums(state, 8);
    const second = recommendAlbums(state, 8);
    expect(first.map((item) => item.album.id)).toEqual(second.map((item) => item.album.id));
    expect(first.every((item) => item.reasons.length > 0)).toBe(true);
    expect(first.some((item) => item.reasons.join(" ").includes("工作"))).toBe(true);
  });
  it("excludes seeds, listened, dismissed and not-for-me records", () => {
    const [seed, listened, dismissed, disliked] = catalogAlbums.slice(0, 4);
    const state = { ...createInitialUserState(), onboardingCompleted: true, taste: { ...createInitialUserState().taste, genres: seed.coreGenres, seedAlbumIds: [seed.id] }, listenedAlbumIds: [listened.id], dismissedAlbumIds: [dismissed.id], recommendationFeedback: { [disliked.id]: "not_for_me" as const } };
    const ids = recommendAlbums(state).map((item) => item.album.id);
    expect(ids).not.toContain(seed.id);
    expect(ids).not.toContain(listened.id);
    expect(ids).not.toContain(dismissed.id);
    expect(ids).not.toContain(disliked.id);
  });
  it("limits repeated artists and genre concentration", () => {
    const output = recommendAlbums(createInitialUserState(), 18);
    const artists = output.map((item) => item.album.artists[0]?.id);
    expect(new Set(artists).size).toBe(artists.length);
    const counts = Object.values(Object.groupBy(output, (item) => item.album.coreGenres[0])).map((items) => items?.length ?? 0);
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
  });
});
