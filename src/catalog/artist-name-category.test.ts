import { describe, expect, it } from "vitest";
import { publishedArtists } from "./published-catalog";
import { countArtistNameCategories, getArtistNameCategory } from "./artist-name-category";

describe("artist display-name categories", () => {
  it.each([
    ["王菲", "han"],
    ["Miles Davis", "latin"],
    ["宇多田ヒカル", "kana"],
    ["아이유 IU", "hangul"],
    ["808", "other"],
  ] as const)("classifies %s without making a geography claim", (name, expected) => {
    expect(getArtistNameCategory(name)).toBe(expected);
  });

  it("assigns every published artist to exactly one visible bucket", () => {
    const counts = countArtistNameCategories(publishedArtists);
    expect(counts.han + counts.latin + counts.kana + counts.hangul + counts.other).toBe(counts.all);
    expect(counts.all).toBe(publishedArtists.length);
  });
});
