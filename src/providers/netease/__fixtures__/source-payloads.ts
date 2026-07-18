export const syntheticAlbumDetailPayload = {
  album: {
    id: 710001,
    name: "Synthetic Aurora Archive",
    alias: ["Synthetic Northern Study"],
    artists: [{ id: 720001, name: "Synthetic Ensemble" }],
    publishTime: 1_704_067_200_000,
    type: "Album",
    subType: "Studio",
    company: "Synthetic Imprint",
    picUrl: "https://example.invalid/synthetic-cover.jpg",
    size: 2,
  },
  songs: [
    {
      id: 730001,
      name: "Synthetic Opening",
      no: 1,
      cd: "CD 1",
      ar: [{ id: 720001, name: "Synthetic Ensemble" }],
      dt: 181_000,
    },
    {
      id: "730002",
      name: "Synthetic Closing",
      no: 2,
      cd: "CD 2",
      ar: [
        { id: 720001, name: "Synthetic Ensemble" },
        { id: 720002, name: "Synthetic Guest" },
      ],
      dt: 203_000,
    },
  ],
} as const;

export const syntheticAlbumFallbackPayload = {
  album: {
    id: "710002",
    name: "Synthetic Fallback Record",
    transNames: ["Synthetic Alternate Name"],
    artist: { id: "720003", name: "Synthetic Soloist" },
    releaseDate: "1704067200000",
    type: "EP",
    subtype: "Live",
    publishCompany: "Synthetic Archive Label",
    coverUrl: "https://example.invalid/synthetic-fallback.jpg",
    trackCount: "1",
    songs: [
      {
        id: "730003",
        name: "Synthetic Fallback Track",
        trackNumber: "7",
        disc: "Disc 2",
        artists: [{ id: "720003", name: "Synthetic Soloist" }],
        duration: "0",
      },
    ],
  },
} as const;

export const syntheticSearchPayload = {
  result: {
    albums: [syntheticAlbumDetailPayload.album],
  },
} as const;

export const syntheticSearchFallbackPayload = {
  albums: [syntheticAlbumFallbackPayload.album],
} as const;

export const syntheticNewReleasePayload = {
  monthData: [syntheticAlbumDetailPayload.album, syntheticAlbumFallbackPayload.album],
} as const;

export const syntheticMalformedAlbumPayload = {
  id: Number.MAX_SAFE_INTEGER + 1,
  name: null,
  alias: ["Synthetic Valid Alias", 17],
  artists: [{ id: -1, name: "" }],
  publishTime: "not-a-decimal-time",
  type: "SyntheticUnmappedFormat",
  company: "",
  size: -2,
  songs: [
    {
      id: null,
      name: "Synthetic Track Without Source Number",
      ar: [],
      dt: -1,
    },
  ],
} as const;
