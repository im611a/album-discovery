import { describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { catalogAlbums } from "./published-catalog";
import { recommendAlbums } from "./recommendation";

const baseState = () => ({
  ...createInitialUserState(),
  onboardingCompleted: true,
  taste: { ...createInitialUserState().taste, genres: ["ambient"], contexts: ["工作"] },
});

describe("recommendation state signals", () => {
  it("uses saved albums as weak seeds while excluding them from their own recommendations", () => {
    const saved = catalogAlbums.find((album) => album.slug === "music-has-right-to-children")!;
    const before = recommendAlbums(baseState(), 12);
    const after = recommendAlbums({ ...baseState(), savedAlbumIds: [saved.id] }, 12);
    expect(after.map((item) => item.album.id)).not.toContain(saved.id);
    expect(after.map((item) => item.album.id)).not.toEqual(before.map((item) => item.album.id));
  });

  it("treats favorite and imported like as the same strong, self-excluding seed", () => {
    const favorite = catalogAlbums.find((album) => album.slug === "promises")!;
    const favoriteIds = recommendAlbums({ ...baseState(), favoriteAlbumIds: [favorite.id] }).map((item) => item.album.id);
    const importedLikeIds = recommendAlbums({ ...baseState(), recommendationFeedback: { [favorite.id]: "like" } }).map((item) => item.album.id);
    expect(favoriteIds).not.toContain(favorite.id);
    expect(importedLikeIds).not.toContain(favorite.id);
  });

  it.each(["listenedAlbumIds", "dismissedAlbumIds"] as const)("excludes an album in %s", (key) => {
    const target = recommendAlbums(baseState(), 1)[0]!.album;
    const state = { ...baseState(), [key]: [target.id] };
    expect(recommendAlbums(state).map((item) => item.album.id)).not.toContain(target.id);
  });

  it("uses not-for-me both as an exclusion and a negative similarity signal", () => {
    const target = catalogAlbums.find((album) => album.slug === "ambient-1-music-for-airports")!;
    const output = recommendAlbums({ ...baseState(), recommendationFeedback: { [target.id]: "not_for_me" } });
    expect(output.map((item) => item.album.id)).not.toContain(target.id);
    expect(output.every((item) => item.score >= 0)).toBe(true);
  });
});
