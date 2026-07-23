import { describe, expect, it } from "vitest";
import { discoverAlbums } from "./queries";
import { catalogAlbums } from "./published-catalog";

describe("optional RYM rating behavior", () => {
  const base = catalogAlbums.slice(0, 4);
  const enriched = [
    { ...base[0], rymRating: 3.8, rymRatingCount: 10 },
    { ...base[1], rymRating: null, rymRatingCount: null },
    { ...base[2], rymRating: 4.1, rymRatingCount: null },
    { ...base[3], rymRating: 3.8, rymRatingCount: 20 },
  ];

  it("sorts rated albums before null values and rating descending", () => {
    const result = discoverAlbums({}, "rym-rating-desc", enriched);
    expect(result.map((album) => album.id)).toEqual([base[2].id, base[3].id, base[0].id, base[1].id]);
  });

  it("uses rating count only when both tied records have a count", () => {
    const left = { ...base[0], rymRating: 4, rymRatingCount: null };
    const right = { ...base[1], rymRating: 4, rymRatingCount: 9999 };
    const result = discoverAlbums({}, "rym-rating-desc", [left, right]);
    expect(result.map((album) => album.id)).toEqual(discoverAlbums({}, "rym-rating-desc", [left, right]).map((album) => album.id));
  });

  it("never treats a null rating as zero", () => {
    expect(discoverAlbums({}, "rym-rating-desc", enriched).at(-1)?.rymRating).toBeNull();
  });
});
