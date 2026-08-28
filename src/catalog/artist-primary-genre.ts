import type { PublishedArtistIndex } from "./schema";

export const ARTIST_GENRE_GROUPS = [
  { key: "all", label: "全部艺人", genres: [] },
  { key: "pop", label: "流行", genres: ["pop", "art-pop", "dream-pop", "experimental-pop"] },
  { key: "hip-hop", label: "嘻哈", genres: ["hip-hop"] },
  { key: "rock", label: "摇滚", genres: ["rock", "alternative-rock", "indie-rock", "post-rock", "experimental-rock"] },
  { key: "folk", label: "民谣", genres: ["folk"] },
  { key: "electronic", label: "电子", genres: ["electronic"] },
  { key: "ambient", label: "氛围音乐", genres: ["ambient"] },
  { key: "jazz", label: "爵士", genres: ["jazz"] },
  { key: "metal", label: "金属", genres: ["metal"] },
  { key: "other", label: "其他 / 未分类", genres: [] },
] as const;

export type ArtistGenreGroup = (typeof ARTIST_GENRE_GROUPS)[number]["key"];

/**
 * The published artist index already orders commonCoreGenres by descending
 * album count, then by the stable genre key. Taking its first value therefore
 * preserves the catalog publisher's deterministic evidence and tie-break.
 */
export function getArtistPrimaryGenre(artist: Pick<PublishedArtistIndex, "commonCoreGenres">) {
  return artist.commonCoreGenres[0] ?? null;
}

export function getArtistGenreGroup(artist: Pick<PublishedArtistIndex, "commonCoreGenres">): Exclude<ArtistGenreGroup, "all"> {
  const primaryGenre = getArtistPrimaryGenre(artist);
  if (!primaryGenre) return "other";
  for (const group of ARTIST_GENRE_GROUPS) {
    if (group.key === "all" || group.key === "other") continue;
    if ((group.genres as readonly string[]).includes(primaryGenre)) return group.key;
  }
  return "other";
}

export function countArtistGenreGroups(artists: readonly PublishedArtistIndex[]) {
  const counts = Object.fromEntries(ARTIST_GENRE_GROUPS.map((group) => [group.key, 0])) as Record<ArtistGenreGroup, number>;
  counts.all = artists.length;
  for (const artist of artists) counts[getArtistGenreGroup(artist)] += 1;
  return Object.freeze(counts);
}
