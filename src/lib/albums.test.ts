import { describe, expect, it } from "vitest";

import { albumsMock, type MockAlbum } from "@/data/albums.mock";

import { byHighestRating, byRecentlyAdded } from "./albums";

function albumWith(
  id: string,
  rymScore: number | null,
  rymRatingCount: number | null,
  addedAt = "2026-01-01T00:00:00.000Z",
): MockAlbum {
  return {
    ...albumsMock[0],
    id,
    slug: id,
    title: id,
    rymScore,
    rymRatingCount,
    addedAt,
  };
}

describe("album selectors", () => {
  it("preserves the existing high-rating behavior without a threshold", () => {
    const results = byHighestRating(albumsMock);

    expect(results).toHaveLength(16);
    expect(results[0].title).toBe("Night Bus to Nowhere");
  });

  it("filters albums below a supplied rating-count threshold", () => {
    const results = byHighestRating(albumsMock, 2_500);

    expect(results.every((album) => album.rymRatingCount >= 2_500)).toBe(true);
  });

  it("keeps an album whose rating count equals the threshold", () => {
    const album = albumWith("equal", 4.1, 2_500);

    expect(byHighestRating([album], 2_500)).toEqual([album]);
  });

  it("keeps an album whose rating count is above the threshold", () => {
    const album = albumWith("above", 4.1, 2_501);

    expect(byHighestRating([album], 2_500)).toEqual([album]);
  });

  it("removes an album whose rating count is below the threshold", () => {
    const album = albumWith("below", 4.9, 2_499);

    expect(byHighestRating([album], 2_500)).toEqual([]);
  });

  it("excludes albums without a complete RYM rating", () => {
    const missingScore = albumWith("missing-score", null, 4_000);
    const missingCount = albumWith("missing-count", 4.2, null);

    expect(byHighestRating([missingScore, missingCount], 2_500)).toEqual([]);
  });

  it("sorts qualifying albums by score descending", () => {
    const lower = albumWith("lower", 3.8, 4_000);
    const higher = albumWith("higher", 4.2, 4_000);

    expect(byHighestRating([lower, higher], 2_500).map((album) => album.id)).toEqual([
      "higher",
      "lower",
    ]);
  });

  it("uses rating count as the stable secondary order for equal scores", () => {
    const fewer = albumWith("fewer", 4.1, 3_000);
    const more = albumWith("more", 4.1, 6_000);

    expect(byHighestRating([fewer, more], 2_500).map((album) => album.id)).toEqual([
      "more",
      "fewer",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [albumWith("lower", 3.8, 4_000), albumWith("higher", 4.2, 4_000)];
    const originalOrder = input.map((album) => album.id);

    byHighestRating(input, 2_500);

    expect(input.map((album) => album.id)).toEqual(originalOrder);
  });

  it("keeps the recently-added selector available and working", () => {
    const older = albumWith("older", 4, 3_000, "2026-01-01T00:00:00.000Z");
    const newer = albumWith("newer", 4, 3_000, "2026-02-01T00:00:00.000Z");

    expect(byRecentlyAdded([older, newer]).map((album) => album.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("never backfills albums below the threshold", () => {
    const qualifying = albumWith("qualifying", 3.8, 2_500);
    const below = albumWith("below", 5, 2_499);

    expect(byHighestRating([qualifying, below], 2_500)).toEqual([qualifying]);
  });
});
