import type { PublishedAlbumSummary } from "@/catalog/schema";

export type EditorialAlbumSize = "large" | "medium" | "small";

export interface EditorialAlbumSlot {
  slot: string;
  albumSlug: string;
  size: EditorialAlbumSize;
  gridColumn: string;
  gridRow: string;
  alignment: "start" | "center" | "end";
  treatment: "plain" | "offset-up" | "offset-down";
  labelPosition: "below" | "side";
  priority: number;
  desktopVisible: boolean;
  tabletVisible: boolean;
  mobileVisible: boolean;
}

export const EDITORIAL_ALBUM_SLOTS: readonly EditorialAlbumSlot[] = [
  { slot: "lead", albumSlug: "inside-the-cable-temple", size: "large", gridColumn: "1 / span 5", gridRow: "2 / span 5", alignment: "start", treatment: "plain", labelPosition: "below", priority: 1, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { slot: "upper-right", albumSlug: "fuzao", size: "medium", gridColumn: "9 / span 3", gridRow: "1 / span 3", alignment: "end", treatment: "offset-up", labelPosition: "below", priority: 2, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { slot: "center-small", albumSlug: "fantasy-jay-chou", size: "small", gridColumn: "6 / span 2", gridRow: "4 / span 2", alignment: "center", treatment: "plain", labelPosition: "side", priority: 3, desktopVisible: true, tabletVisible: true, mobileVisible: false },
  { slot: "lower-right", albumSlug: "black-dream", size: "medium", gridColumn: "8 / span 4", gridRow: "6 / span 4", alignment: "end", treatment: "offset-down", labelPosition: "below", priority: 4, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { slot: "lower-left", albumSlug: "cassa-nova", size: "small", gridColumn: "2 / span 2", gridRow: "8 / span 2", alignment: "start", treatment: "offset-down", labelPosition: "below", priority: 5, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { slot: "edge-right", albumSlug: "zero-point-seven", size: "small", gridColumn: "11 / span 2", gridRow: "4 / span 2", alignment: "end", treatment: "plain", labelPosition: "side", priority: 6, desktopVisible: true, tabletVisible: false, mobileVisible: false },
  { slot: "mid-left", albumSlug: "arthropods", size: "small", gridColumn: "5 / span 2", gridRow: "7 / span 2", alignment: "center", treatment: "offset-up", labelPosition: "below", priority: 7, desktopVisible: true, tabletVisible: false, mobileVisible: true },
  { slot: "far-right", albumSlug: "madvillainy", size: "medium", gridColumn: "9 / span 3", gridRow: "10 / span 3", alignment: "end", treatment: "plain", labelPosition: "below", priority: 8, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { slot: "closing", albumSlug: "wake-after-the-rain", size: "small", gridColumn: "4 / span 2", gridRow: "11 / span 2", alignment: "start", treatment: "offset-down", labelPosition: "below", priority: 9, desktopVisible: true, tabletVisible: true, mobileVisible: true },
] as const;

export const FEATURED_ALBUM_SLUGS = [
  "fuzao",
  "inside-the-cable-temple",
  "ok-computer",
] as const;

export const FEATURED_ARTIST_SLUGS = [
  "artist-6452",
  "artist-15289",
  "artist-2515",
] as const;

export function resolveEditorialAlbums(
  albums: PublishedAlbumSummary[],
  slots: readonly EditorialAlbumSlot[] = EDITORIAL_ALBUM_SLOTS,
  onFallback: (slot: EditorialAlbumSlot, album: PublishedAlbumSummary) => void = () => undefined,
) {
  const bySlug = new Map(albums.map((album) => [album.slug, album]));
  const used = new Set<string>();
  const fallback = [...albums].sort((a, b) =>
    Number(Boolean(b.editorial)) - Number(Boolean(a.editorial)) ||
    (b.releaseYear ?? 0) - (a.releaseYear ?? 0) ||
    a.slug.localeCompare(b.slug),
  );

  return [...slots]
    .sort((a, b) => a.priority - b.priority)
    .map((slot) => {
      const configured = bySlug.get(slot.albumSlug);
      const album = configured && !used.has(configured.id)
        ? configured
        : fallback.find((candidate) => !used.has(candidate.id));
      if (!album) return null;
      if (album.slug !== slot.albumSlug) onFallback(slot, album);
      used.add(album.id);
      return {
        slot,
        album,
        usedFallback: album.slug !== slot.albumSlug,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export function resolveConfiguredAlbums(
  albums: PublishedAlbumSummary[],
  slugs: readonly string[],
) {
  const bySlug = new Map(albums.map((album) => [album.slug, album]));
  const used = new Set<string>();
  return slugs.flatMap((slug) => {
    const album = bySlug.get(slug);
    if (!album || used.has(album.id)) return [];
    used.add(album.id);
    return [album];
  });
}
