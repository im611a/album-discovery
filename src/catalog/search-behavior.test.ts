import { describe, expect, it } from "vitest";
import { searchAlbums } from "./queries";

describe("local search behavior", () => {
  it.each([
    ["浮躁", "fuzao"],
    ["王菲", "fuzao"],
    ["在雨后醒来", "wake-after-the-rain"],
    ["SASIOVERLXRD", "super-mr-sun"],
    ["OK Computer", "ok-computer"],
    ["RADIOHEAD", "ok-computer"],
    ["Fantasy", "fantasy-jay-chou"],
  ])("finds %s in the checked-in catalog", (query, expectedSlug) => expect(searchAlbums(query).map((album) => album.slug)).toContain(expectedSlug));

  it("deduplicates one album even when several fields match", () => {
    const ids = searchAlbums("周杰伦 Fantasy").map((album) => album.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("returns an honest empty result for an unknown term", () => expect(searchAlbums("绝对不存在的专辑关键词xyz")).toEqual([]));
  it("only uses aliases that are present in the published NetEase snapshot", () => {
    expect(searchAlbums("Yeh Hui–mei").map((album) => album.slug)).toContain("ye-hui-mei");
    expect(searchAlbums("unverified-alias-that-is-not-published")).toEqual([]);
  });
  it("does not search taxonomy or listening-context fields", () => {
    expect(searchAlbums("ambient")).toEqual([]);
    expect(searchAlbums("夜晚")).toEqual([]);
  });
});
