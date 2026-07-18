import { describe, expect, it } from "vitest";
import { searchAlbums } from "./queries";

describe("local search behavior", () => {
  it.each([
    ["浮躁", "fuzao"],
    ["王菲", "fuzao"],
    ["In Rainbows", "in-rainbows"],
    ["RADIOHEAD", "in-rainbows"],
    ["ambient", "ambient-1-music-for-airports"],
    ["朦胧", "heaven-or-las-vegas"],
  ])("finds %s in the checked-in catalog", (query, expectedSlug) => expect(searchAlbums(query).map((album) => album.slug)).toContain(expectedSlug));

  it("deduplicates one album even when several fields match", () => {
    const ids = searchAlbums("Black Sabbath").map((album) => album.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("returns an honest empty result for an unknown term", () => expect(searchAlbums("绝对不存在的专辑关键词xyz")).toEqual([]));
  it("does not claim alternate-title coverage when the fixed snapshot has no verified aliases", () => expect(searchAlbums("unverified-alias-that-is-not-published")).toEqual([]));
});
