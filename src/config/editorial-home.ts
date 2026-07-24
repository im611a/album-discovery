import type { PublishedAlbumSummary } from "@/catalog/schema";

export type EditorialAlbumSize = "large" | "medium" | "small";

export interface EditorialAlbumSlot {
  chapter: "cool" | "warm";
  slot: string;
  albumSlug: string;
  palette: "ink" | "navy" | "silver" | "paper" | "amber" | "rose";
  visualWeight: "lead" | "support" | "accent";
  depth: number;
  pointerStrength: number;
  initialRotation: number;
  entryDirection: "left" | "right" | "up" | "down";
  zIndex: number;
  maxWidth: number;
  cropMode: "contain" | "cover";
  edgeTreatment: "line" | "matte" | "none";
  matteColor: string;
  localBackdrop: "none" | "cool-halo" | "warm-halo";
  contrastMode: "normal" | "lift-dark";
  overlapGroup: string | null;
  allowOverlap: boolean;
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
  { chapter: "cool", slot: "lead", albumSlug: "inside-the-cable-temple", palette: "ink", visualWeight: "lead", depth: 1, pointerStrength: 14, initialRotation: -1.2, entryDirection: "left", zIndex: 4, maxWidth: 360, cropMode: "contain", edgeTreatment: "line", matteColor: "#0a1523", localBackdrop: "cool-halo", contrastMode: "lift-dark", overlapGroup: null, allowOverlap: false, size: "large", gridColumn: "1 / span 5", gridRow: "2 / span 5", alignment: "start", treatment: "plain", labelPosition: "below", priority: 1, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { chapter: "cool", slot: "upper-right", albumSlug: "fuzao", palette: "silver", visualWeight: "support", depth: .64, pointerStrength: 10, initialRotation: .8, entryDirection: "right", zIndex: 3, maxWidth: 220, cropMode: "contain", edgeTreatment: "matte", matteColor: "#182331", localBackdrop: "none", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "medium", gridColumn: "9 / span 3", gridRow: "2 / span 3", alignment: "end", treatment: "plain", labelPosition: "below", priority: 2, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { chapter: "cool", slot: "center-small", albumSlug: "fantasy-jay-chou", palette: "navy", visualWeight: "accent", depth: .38, pointerStrength: 6, initialRotation: -.5, entryDirection: "up", zIndex: 2, maxWidth: 150, cropMode: "contain", edgeTreatment: "line", matteColor: "#101c2b", localBackdrop: "none", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "small", gridColumn: "6 / span 2", gridRow: "4 / span 2", alignment: "center", treatment: "plain", labelPosition: "side", priority: 3, desktopVisible: true, tabletVisible: true, mobileVisible: false },
  { chapter: "cool", slot: "lower-right", albumSlug: "black-dream", palette: "ink", visualWeight: "support", depth: .82, pointerStrength: 12, initialRotation: 1, entryDirection: "right", zIndex: 3, maxWidth: 260, cropMode: "contain", edgeTreatment: "line", matteColor: "#0a1523", localBackdrop: "cool-halo", contrastMode: "lift-dark", overlapGroup: null, allowOverlap: false, size: "medium", gridColumn: "8 / span 4", gridRow: "6 / span 4", alignment: "end", treatment: "plain", labelPosition: "below", priority: 4, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { chapter: "warm", slot: "lower-left", albumSlug: "cassa-nova", palette: "paper", visualWeight: "accent", depth: .42, pointerStrength: 6, initialRotation: -.7, entryDirection: "left", zIndex: 2, maxWidth: 140, cropMode: "contain", edgeTreatment: "matte", matteColor: "#28231e", localBackdrop: "warm-halo", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "small", gridColumn: "2 / span 2", gridRow: "10 / span 2", alignment: "start", treatment: "plain", labelPosition: "below", priority: 5, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { chapter: "warm", slot: "edge-right", albumSlug: "zero-point-seven", palette: "rose", visualWeight: "accent", depth: .32, pointerStrength: 5, initialRotation: 1, entryDirection: "right", zIndex: 2, maxWidth: 100, cropMode: "contain", edgeTreatment: "none", matteColor: "#211b20", localBackdrop: "none", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "small", gridColumn: "12 / span 1", gridRow: "4 / span 2", alignment: "end", treatment: "plain", labelPosition: "side", priority: 6, desktopVisible: true, tabletVisible: false, mobileVisible: false },
  { chapter: "warm", slot: "mid-left", albumSlug: "arthropods", palette: "amber", visualWeight: "accent", depth: .5, pointerStrength: 7, initialRotation: -.4, entryDirection: "down", zIndex: 2, maxWidth: 140, cropMode: "contain", edgeTreatment: "matte", matteColor: "#242018", localBackdrop: "warm-halo", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "small", gridColumn: "5 / span 2", gridRow: "8 / span 2", alignment: "center", treatment: "plain", labelPosition: "below", priority: 7, desktopVisible: true, tabletVisible: false, mobileVisible: true },
  { chapter: "warm", slot: "far-right", albumSlug: "madvillainy", palette: "paper", visualWeight: "support", depth: .72, pointerStrength: 10, initialRotation: .7, entryDirection: "right", zIndex: 3, maxWidth: 100, cropMode: "contain", edgeTreatment: "line", matteColor: "#1c1d1c", localBackdrop: "none", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "medium", gridColumn: "12 / span 1", gridRow: "10 / span 3", alignment: "end", treatment: "plain", labelPosition: "below", priority: 8, desktopVisible: true, tabletVisible: true, mobileVisible: true },
  { chapter: "warm", slot: "closing", albumSlug: "wake-after-the-rain", palette: "rose", visualWeight: "accent", depth: .46, pointerStrength: 6, initialRotation: -1, entryDirection: "left", zIndex: 2, maxWidth: 120, cropMode: "contain", edgeTreatment: "matte", matteColor: "#241b20", localBackdrop: "warm-halo", contrastMode: "normal", overlapGroup: null, allowOverlap: false, size: "small", gridColumn: "3 / span 2", gridRow: "10 / span 2", alignment: "end", treatment: "plain", labelPosition: "below", priority: 9, desktopVisible: true, tabletVisible: true, mobileVisible: true },
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
