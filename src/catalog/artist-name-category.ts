import type { PublishedArtistIndex } from "./schema";

export const ARTIST_NAME_CATEGORIES = [
  ["all", "全部艺人"],
  ["han", "含汉字"],
  ["latin", "拉丁字母"],
  ["kana", "含日文假名"],
  ["hangul", "含韩文"],
  ["other", "其他文字"],
] as const;

export type ArtistNameCategory = (typeof ARTIST_NAME_CATEGORIES)[number][0];

const KANA = /[\u3040-\u30ff\u31f0-\u31ff]/u;
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u;
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const LATIN = /[A-Za-z\u00c0-\u024f]/u;

/**
 * A display-name script bucket, never a geography, nationality, or language claim.
 * Kana and Hangul are checked first because names commonly combine them with Han
 * or Latin characters; the labels deliberately say "contains" rather than
 * assigning a country or language.
 */
export function getArtistNameCategory(name: string): Exclude<ArtistNameCategory, "all"> {
  if (KANA.test(name)) return "kana";
  if (HANGUL.test(name)) return "hangul";
  if (HAN.test(name)) return "han";
  if (LATIN.test(name)) return "latin";
  return "other";
}

export function countArtistNameCategories(artists: readonly PublishedArtistIndex[]) {
  const counts: Record<ArtistNameCategory, number> = {
    all: artists.length,
    han: 0,
    latin: 0,
    kana: 0,
    hangul: 0,
    other: 0,
  };
  for (const artist of artists) counts[getArtistNameCategory(artist.name)] += 1;
  return Object.freeze(counts);
}
