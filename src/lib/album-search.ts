import type { MockAlbum } from "@/data/albums.mock";

export type AlbumSearchMatchReason =
  | "title-exact"
  | "alias-exact"
  | "artist-exact"
  | "title-partial"
  | "alias-partial"
  | "artist-partial";

export type AlbumSearchResult = {
  album: MockAlbum;
  matchReason: AlbumSearchMatchReason;
  matchPriority: number;
};

const MATCH_PRIORITIES: Record<AlbumSearchMatchReason, number> = {
  "title-exact": 1,
  "alias-exact": 2,
  "artist-exact": 3,
  "title-partial": 4,
  "alias-partial": 5,
  "artist-partial": 6,
};

export function normalizeSearchQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function includesQuery(values: readonly string[], query: string) {
  return values.some((value) => normalizeSearchQuery(value).includes(query));
}

function equalsQuery(values: readonly string[], query: string) {
  return values.some((value) => normalizeSearchQuery(value) === query);
}

function getMatchReason(
  album: MockAlbum,
  query: string,
): AlbumSearchMatchReason | null {
  const title = normalizeSearchQuery(album.title);

  if (title === query) return "title-exact";
  if (equalsQuery(album.aliases, query)) return "alias-exact";
  if (equalsQuery(album.artists, query)) return "artist-exact";
  if (title.includes(query)) return "title-partial";
  if (includesQuery(album.aliases, query)) return "alias-partial";
  if (includesQuery(album.artists, query)) return "artist-partial";

  return null;
}

function releaseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareReleaseDatesDescending(a: string, b: string) {
  const aTimestamp = releaseTimestamp(a);
  const bTimestamp = releaseTimestamp(b);

  if (aTimestamp === null && bTimestamp === null) return 0;
  if (aTimestamp === null) return 1;
  if (bTimestamp === null) return -1;
  return bTimestamp - aTimestamp;
}

export function searchAlbums(
  albums: readonly MockAlbum[],
  rawQuery: string,
): AlbumSearchResult[] {
  const query = normalizeSearchQuery(rawQuery);

  if (!query) return [];

  const resultByAlbumId = new Map<
    string,
    AlbumSearchResult & { originalIndex: number }
  >();

  albums.forEach((album, originalIndex) => {
    const matchReason = getMatchReason(album, query);
    if (!matchReason) return;

    const matchPriority = MATCH_PRIORITIES[matchReason];
    const existing = resultByAlbumId.get(album.id);

    if (!existing || matchPriority < existing.matchPriority) {
      resultByAlbumId.set(album.id, {
        album,
        matchReason,
        matchPriority,
        originalIndex,
      });
    }
  });

  return [...resultByAlbumId.values()]
    .sort(
      (a, b) =>
        a.matchPriority - b.matchPriority ||
        compareReleaseDatesDescending(a.album.releaseDate, b.album.releaseDate) ||
        a.album.title.localeCompare(b.album.title, "zh-CN") ||
        a.originalIndex - b.originalIndex,
    )
    .map(({ album, matchPriority, matchReason }) => ({
      album,
      matchPriority,
      matchReason,
    }));
}
