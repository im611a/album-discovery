import type { PublishedAlbumSummary } from "@/catalog/schema";

export type CabinetSlotPosition =
  | "north-west"
  | "north-east"
  | "west"
  | "east"
  | "south-west"
  | "south-east";

export interface PhysicalArchiveSlot {
  slot: string;
  albumSlug: string;
  index: number;
  position: CabinetSlotPosition;
  baseSize: 196 | 214 | 226;
  luminance: "light" | "mid" | "dark";
  temperature: "cool" | "neutral" | "warm";
  role: "lead" | "support" | "accent";
  mobileVisible: boolean;
  palette: {
    paper: string;
    edge: string;
    ink: string;
  };
}

export const PHYSICAL_ARCHIVE_SLOTS: readonly PhysicalArchiveSlot[] = [
  {
    slot: "A-01",
    albumSlug: "inside-the-cable-temple",
    index: 1,
    position: "west",
    baseSize: 226,
    luminance: "mid",
    temperature: "neutral",
    role: "lead",
    mobileVisible: true,
    palette: { paper: "#b8ad95", edge: "#d7cdb6", ink: "#171711" },
  },
  {
    slot: "A-02",
    albumSlug: "fuzao",
    index: 2,
    position: "north-east",
    baseSize: 214,
    luminance: "light",
    temperature: "warm",
    role: "support",
    mobileVisible: true,
    palette: { paper: "#d7c2c3", edge: "#efe2df", ink: "#302126" },
  },
  {
    slot: "A-03",
    albumSlug: "fantasy-jay-chou",
    index: 3,
    position: "east",
    baseSize: 214,
    luminance: "mid",
    temperature: "warm",
    role: "support",
    mobileVisible: false,
    palette: { paper: "#8d211b", edge: "#d94c38", ink: "#150909" },
  },
  {
    slot: "A-04",
    albumSlug: "black-dream",
    index: 4,
    position: "north-west",
    baseSize: 196,
    luminance: "mid",
    temperature: "cool",
    role: "support",
    mobileVisible: false,
    palette: { paper: "#68705f", edge: "#babd9c", ink: "#10130f" },
  },
  {
    slot: "A-05",
    albumSlug: "arthropods",
    index: 5,
    position: "south-west",
    baseSize: 196,
    luminance: "light",
    temperature: "warm",
    role: "accent",
    mobileVisible: false,
    palette: { paper: "#e9e5dc", edge: "#c93023", ink: "#25120f" },
  },
  {
    slot: "A-06",
    albumSlug: "loveless",
    index: 6,
    position: "south-east",
    baseSize: 214,
    luminance: "dark",
    temperature: "warm",
    role: "accent",
    mobileVisible: false,
    palette: { paper: "#a12e55", edge: "#dc7698", ink: "#1c0912" },
  },
] as const;

export const FEATURED_ALBUM_SLUGS = [
  "inside-the-cable-temple",
  "fuzao",
  "ok-computer",
] as const;

export const FEATURED_ARTIST_SLUGS = [
  "artist-6452",
  "artist-15289",
  "artist-2515",
] as const;

export function resolvePhysicalArchiveAlbums(
  albums: PublishedAlbumSummary[],
  slots: readonly PhysicalArchiveSlot[] = PHYSICAL_ARCHIVE_SLOTS,
  onFallback: (slot: PhysicalArchiveSlot, album: PublishedAlbumSummary) => void = () => undefined,
) {
  const bySlug = new Map(albums.map((album) => [album.slug, album]));
  const used = new Set<string>();
  const fallback = [...albums].sort((a, b) =>
    Number(Boolean(b.editorial)) - Number(Boolean(a.editorial)) ||
    (b.releaseYear ?? 0) - (a.releaseYear ?? 0) ||
    a.slug.localeCompare(b.slug),
  );

  return [...slots]
    .sort((a, b) => a.index - b.index)
    .map((slot) => {
      const configured = bySlug.get(slot.albumSlug);
      const album = configured && !used.has(configured.id)
        ? configured
        : fallback.find((candidate) => !used.has(candidate.id));
      if (!album) return null;
      if (album.slug !== slot.albumSlug) onFallback(slot, album);
      used.add(album.id);
      return { slot, album, usedFallback: album.slug !== slot.albumSlug };
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
