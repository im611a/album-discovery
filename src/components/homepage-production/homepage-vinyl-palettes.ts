export interface AlbumVinylPalette {
  dominant: `#${string}`;
  secondary: `#${string}`;
  light: `#${string}`;
  sourceCover: `/${string}`;
  sourceCoverSha256: string;
}

// Deterministically extracted from the approved Stage albums' local 72 px cover samples.
// The cover hash keeps this build-time palette evidence tied to the exact local artwork.
export const HOMEPAGE_STAGE_VINYL_PALETTES = {
  "album:29704": {
    dominant: "#d2778a",
    secondary: "#070806",
    light: "#d9a7a8",
    sourceCover: "/catalog/covers/detail/29704.webp",
    sourceCoverSha256: "f890f21dd78d952b27d4cf94558d6a3ec844b3d88a013a2d748ba475bee3ad16",
  },
  "album:2046781": {
    dominant: "#695958",
    secondary: "#d65946",
    light: "#f6aa75",
    sourceCover: "/catalog/covers/detail/2046781.webp",
    sourceCoverSha256: "298346e20d43c3eb44032709df62faf9297c7ccf9ef8cdbcaf81f084678a65c8",
  },
  "album:1974794": {
    dominant: "#270257",
    secondary: "#673957",
    light: "#ecdde3",
    sourceCover: "/catalog/covers/detail/1974794.webp",
    sourceCoverSha256: "eb43e02a7bd95219f87c6562333c0b513cdabd300ac84905b11ede66296438b7",
  },
  "album:35745181": {
    dominant: "#fda925",
    secondary: "#484526",
    light: "#f6d996",
    sourceCover: "/catalog/covers/detail/35745181.webp",
    sourceCoverSha256: "35edcc50fcc7a4a124ca93672384b5f3f51bf116eeb811ecd3681cc0fe74313f",
  },
  "album:2298031": {
    dominant: "#888a9a",
    secondary: "#25181a",
    light: "#aaa9b1",
    sourceCover: "/catalog/covers/detail/2298031.webp",
    sourceCoverSha256: "bc0c3a2b22ccc22d22af5da1b409b75165feeb9ceb1e579c35f708a1fd045281",
  },
  "album:155679106": {
    dominant: "#292609",
    secondary: "#674612",
    light: "#e8a734",
    sourceCover: "/catalog/covers/detail/155679106.webp",
    sourceCoverSha256: "3d53d507043ddac7bf4c182c6cd0423de4b098803c4d8d06855b408e649a43c0",
  },
} as const satisfies Record<string, AlbumVinylPalette>;

export function getHomepageStageVinylPalette(albumId: string): AlbumVinylPalette {
  const palette = HOMEPAGE_STAGE_VINYL_PALETTES[albumId as keyof typeof HOMEPAGE_STAGE_VINYL_PALETTES];
  if (!palette) throw new Error(`首页 Stage 专辑缺少本地封面色板：${albumId}`);
  return palette;
}
