import { describe, expect, it } from "vitest";

import {
  syntheticAlbumDetailPayload,
  syntheticAlbumFallbackPayload,
  syntheticMalformedAlbumPayload,
  syntheticNewReleasePayload,
  syntheticSearchFallbackPayload,
  syntheticSearchPayload,
} from "@/providers/netease/__fixtures__/source-payloads";
import {
  parseNeteaseAlbumDetailPayload,
  parseNeteaseAlbumSearchPayload,
  parseNeteaseAlbumSource,
  parseNeteaseNewReleasePayload,
  parseNeteaseNewReleaseRecord,
} from "@/providers/netease/parse-source-dto";

describe("parseNeteaseAlbumDetailPayload", () => {
  it("parses the observed album and root songs paths", () => {
    const result = parseNeteaseAlbumDetailPayload(syntheticAlbumDetailPayload);

    expect(result.issues).toEqual([]);
    expect(result.data).toMatchObject({
      externalAlbumId: { state: "PRESENT", value: "710001" },
      title: { state: "PRESENT", value: "Synthetic Aurora Archive" },
      aliases: { state: "PRESENT", value: ["Synthetic Northern Study"] },
      reportedTrackCount: { state: "PRESENT", value: 2 },
    });
    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [
        { sourcePosition: 1, trackNumber: { state: "PRESENT", value: 1 } },
        { sourcePosition: 2, trackNumber: { state: "PRESENT", value: 2 } },
      ],
    });
    if (result.data?.tracks.state !== "PRESENT") throw new Error("Expected parsed tracks.");
    expect(result.data.tracks.value.map((track) => track.discNumber)).toEqual([
      { state: "PRESENT", value: 1 },
      { state: "PRESENT", value: 2 },
    ]);
  });

  it("parses all observed fallback paths without changing source values", () => {
    const result = parseNeteaseAlbumDetailPayload(syntheticAlbumFallbackPayload);

    expect(result.issues).toEqual([]);
    expect(result.data).toMatchObject({
      aliases: { state: "PRESENT", value: ["Synthetic Alternate Name"] },
      artists: {
        state: "PRESENT",
        value: [{ externalArtistId: { state: "PRESENT", value: "720003" } }],
      },
      releaseTimestampMs: { state: "PRESENT", value: 1_704_067_200_000 },
      rawSubType: { state: "PRESENT", value: "Live" },
      company: { state: "PRESENT", value: "Synthetic Archive Label" },
      coverUrl: { state: "PRESENT", value: "https://example.invalid/synthetic-fallback.jpg" },
      reportedTrackCount: { state: "PRESENT", value: 1 },
    });
    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [
        {
          sourcePosition: 1,
          trackNumber: { state: "PRESENT", value: 7 },
          discNumber: { state: "PRESENT", value: 2 },
          durationMs: { state: "PRESENT", value: 0 },
        },
      ],
    });
  });

  it("prefers root songs over album.songs for the observed detail response shape", () => {
    const input = {
      album: {
        ...syntheticAlbumFallbackPayload.album,
        songs: [{ ...syntheticAlbumFallbackPayload.album.songs[0], name: "Album Nested Track" }],
      },
      songs: [{ ...syntheticAlbumFallbackPayload.album.songs[0], name: "Root Response Track" }],
    };
    const result = parseNeteaseAlbumDetailPayload(input);
    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [{ title: { state: "PRESENT", value: "Root Response Track" } }],
    });
  });
});

describe("search and new-release response fallbacks", () => {
  it("parses result.albums and the root albums fallback", () => {
    const primary = parseNeteaseAlbumSearchPayload(syntheticSearchPayload);
    const fallback = parseNeteaseAlbumSearchPayload(syntheticSearchFallbackPayload);
    expect(primary.data).toHaveLength(1);
    expect(fallback.data).toHaveLength(1);
    expect(fallback.data?.[0].title).toEqual({
      state: "PRESENT",
      value: "Synthetic Fallback Record",
    });
  });

  it("parses monthData and associates only caller-supplied market provenance", () => {
    const result = parseNeteaseNewReleasePayload(syntheticNewReleasePayload, {
      requestedMarketChannel: "JP",
      sourceListEndpoint: "/synthetic/album/new",
      fetchedAt: "2026-07-17T00:00:00.000Z",
    });

    expect(result.data).toHaveLength(2);
    expect(result.data?.map((record) => record.sourcePosition)).toEqual([1, 2]);
    expect(result.data?.[0]).toMatchObject({
      requestedMarketChannel: "JP",
      sourceListEndpoint: "/synthetic/album/new",
    });
    expect(Object.keys(result.data?.[0].album ?? {})).not.toEqual(
      expect.arrayContaining(["country", "region", "language"]),
    );
  });

  it("supports the observed weekData new-release fallback", () => {
    const result = parseNeteaseNewReleasePayload(
      { weekData: [syntheticAlbumDetailPayload.album] },
      {
        requestedMarketChannel: "ALL",
        sourceListEndpoint: "/synthetic/album/new",
        fetchedAt: "2026-07-17T00:00:00.000Z",
      },
    );
    expect(result.data).toHaveLength(1);
  });
});

describe("fallback conflict matrix", () => {
  const primaryAlbum = { ...syntheticAlbumDetailPayload.album, name: "Synthetic Primary Record" };
  const fallbackAlbum = { ...syntheticAlbumFallbackPayload.album, name: "Synthetic Backup Record" };
  const newReleaseContext = {
    requestedMarketChannel: "ALL",
    sourceListEndpoint: "/synthetic/album/new",
    fetchedAt: "2026-07-17T00:00:00.000Z",
  } as const;

  it("keeps a PRESENT primary wrapper over a PRESENT fallback", () => {
    const result = parseNeteaseAlbumSearchPayload({
      result: { albums: [primaryAlbum] },
      albums: [fallbackAlbum],
    });
    expect(result.data?.[0].title).toEqual({ state: "PRESENT", value: "Synthetic Primary Record" });
  });

  it("continues from an EXPLICIT_NULL or ABSENT primary wrapper to a PRESENT fallback", () => {
    expect(
      parseNeteaseAlbumSearchPayload({ result: { albums: null }, albums: [fallbackAlbum] }).data?.[0]
        .title,
    ).toEqual({ state: "PRESENT", value: "Synthetic Backup Record" });
    expect(parseNeteaseAlbumSearchPayload({ albums: [fallbackAlbum] }).data).toHaveLength(1);
  });

  it("stops at an INVALID primary wrapper instead of masking it with a fallback", () => {
    const result = parseNeteaseAlbumSearchPayload({
      result: { albums: { invalid: true } },
      albums: [fallbackAlbum],
    });
    expect(result.data).toBeNull();
    expect(result.issues.map((item) => item.code)).toContain("INVALID_ALBUM_LIST");
  });

  it("preserves final EXPLICIT_NULL, INVALID, and ABSENT wrapper outcomes", () => {
    expect(parseNeteaseAlbumSearchPayload({ result: { albums: null } })).toMatchObject({
      data: null,
      issues: [{ code: "ALBUM_LIST_NULL" }],
    });
    expect(
      parseNeteaseAlbumSearchPayload({ result: { albums: null }, albums: "invalid" }),
    ).toMatchObject({ data: null, issues: [{ code: "INVALID_ALBUM_LIST" }] });
    expect(parseNeteaseAlbumSearchPayload({})).toMatchObject({
      data: null,
      issues: [{ code: "ALBUM_LIST_ABSENT" }],
    });
  });

  it("treats a primary empty list as PRESENT and does not fall back", () => {
    expect(
      parseNeteaseAlbumSearchPayload({ result: { albums: [] }, albums: [fallbackAlbum] }).data,
    ).toEqual([]);
  });

  it("keeps root songs when both root and album track paths are PRESENT", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: {
        ...syntheticAlbumFallbackPayload.album,
        songs: [{ ...syntheticAlbumFallbackPayload.album.songs[0], name: "Nested Track" }],
      },
      songs: [{ ...syntheticAlbumFallbackPayload.album.songs[0], name: "Root Track" }],
    });

    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [{ title: { state: "PRESENT", value: "Root Track" } }],
    });
  });

  it("falls back from null root songs to album.songs", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: syntheticAlbumFallbackPayload.album,
      songs: null,
    });

    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [{ title: { state: "PRESENT", value: "Synthetic Fallback Track" } }],
    });
  });

  it("falls back from absent root songs to album.songs", () => {
    const result = parseNeteaseAlbumDetailPayload({ album: syntheticAlbumFallbackPayload.album });

    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [{ title: { state: "PRESENT", value: "Synthetic Fallback Track" } }],
    });
  });

  it("does not mask invalid root songs with album.songs", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: syntheticAlbumFallbackPayload.album,
      songs: { invalid: true },
    });

    expect(result.data?.tracks).toMatchObject({ state: "INVALID" });
    expect(result.issues).toContainEqual({
      path: "songs",
      code: "INVALID_TRACK_LIST",
      reason: "Expected a track array.",
    });
  });

  it("keeps an empty root songs list instead of falling back to album.songs", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: syntheticAlbumFallbackPayload.album,
      songs: [],
    });

    expect(result.data?.tracks).toEqual({ state: "PRESENT", value: [] });
  });

  it("preserves EXPLICIT_NULL when root songs is null and album.songs is ABSENT", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: {
        id: "710020",
        name: "Synthetic Album Without Nested Tracks",
        type: "Album",
      },
      songs: null,
    });

    expect(result.data?.tracks).toEqual({ state: "EXPLICIT_NULL" });
    expect(result.data?.tracks).not.toEqual({ state: "ABSENT" });
    expect(result.data?.tracks).not.toEqual({ state: "PRESENT", value: [] });
    expect(result.issues).toEqual([]);
  });

  it("returns ABSENT when both root songs and album.songs are ABSENT", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: {
        id: "710021",
        name: "Synthetic Album Without Any Tracks",
        type: "Album",
      },
    });

    expect(result.data?.tracks).toEqual({ state: "ABSENT" });
    expect(result.data?.tracks).not.toEqual({ state: "EXPLICIT_NULL" });
    expect(result.data?.tracks).not.toEqual({ state: "PRESENT", value: [] });
    expect(result.issues).toEqual([]);
  });

  it("prefers albums over monthData and weekData", () => {
    const result = parseNeteaseNewReleasePayload(
      { albums: [primaryAlbum], monthData: [fallbackAlbum], weekData: [fallbackAlbum] },
      newReleaseContext,
    );

    expect(result.data?.[0].album.title).toEqual({
      state: "PRESENT",
      value: "Synthetic Primary Record",
    });
  });

  it("falls back from null albums to monthData", () => {
    const result = parseNeteaseNewReleasePayload(
      { albums: null, monthData: [fallbackAlbum] },
      newReleaseContext,
    );

    expect(result.data?.[0].album.title).toEqual({
      state: "PRESENT",
      value: "Synthetic Backup Record",
    });
  });

  it("falls back from absent albums and monthData to weekData", () => {
    const result = parseNeteaseNewReleasePayload(
      { weekData: [fallbackAlbum] },
      newReleaseContext,
    );

    expect(result.data?.[0].album.title).toEqual({
      state: "PRESENT",
      value: "Synthetic Backup Record",
    });
  });

  it("does not mask invalid albums with later new-release lists", () => {
    const result = parseNeteaseNewReleasePayload(
      { albums: "invalid", monthData: [fallbackAlbum], weekData: [fallbackAlbum] },
      newReleaseContext,
    );

    expect(result.data).toBeNull();
    expect(result.issues).toContainEqual({
      path: "albums",
      code: "INVALID_ALBUM_LIST",
      reason: "Expected an album array.",
    });
  });

  it("preserves EXPLICIT_NULL when later new-release lists are ABSENT", () => {
    const result = parseNeteaseNewReleasePayload({ albums: null }, newReleaseContext);

    expect(result).toMatchObject({ data: null, issues: [{ path: "albums", code: "ALBUM_LIST_NULL" }] });
  });

  it("returns ABSENT when every new-release list is ABSENT", () => {
    const result = parseNeteaseNewReleasePayload({}, newReleaseContext);

    expect(result).toMatchObject({
      data: null,
      issues: [{ path: "albums", code: "ALBUM_LIST_ABSENT" }],
    });
  });

  it("keeps an empty albums list instead of falling back to later new-release lists", () => {
    const result = parseNeteaseNewReleasePayload(
      { albums: [], monthData: [fallbackAlbum], weekData: [fallbackAlbum] },
      newReleaseContext,
    );

    expect(result.data).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it("stops at INVALID monthData after ABSENT albums instead of using weekData", () => {
    const hiddenWeekAlbum = { ...fallbackAlbum, name: "Synthetic Hidden Week Record A" };
    const result = parseNeteaseNewReleasePayload(
      { monthData: { invalid: true }, weekData: [hiddenWeekAlbum] },
      newReleaseContext,
    );

    expect(result.data).toBeNull();
    expect(result.issues).toEqual([
      {
        path: "monthData",
        code: "INVALID_ALBUM_LIST",
        reason: "Expected an album array.",
      },
    ]);
    expect(JSON.stringify(result.data)).not.toContain("Synthetic Hidden Week Record A");
  });

  it("stops at INVALID monthData after EXPLICIT_NULL albums instead of using weekData", () => {
    const hiddenWeekAlbum = { ...primaryAlbum, name: "Synthetic Hidden Week Record B" };
    const result = parseNeteaseNewReleasePayload(
      { albums: null, monthData: "invalid", weekData: [hiddenWeekAlbum] },
      newReleaseContext,
    );

    expect(result.data).toBeNull();
    expect(result.issues).toEqual([
      {
        path: "monthData",
        code: "INVALID_ALBUM_LIST",
        reason: "Expected an album array.",
      },
    ]);
    expect(result.issues.map((item) => item.code)).not.toContain("ALBUM_LIST_NULL");
    expect(JSON.stringify(result.data)).not.toContain("Synthetic Hidden Week Record B");
  });

  it("applies EXPLICIT_NULL fallback to album and track field chains", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumFallbackPayload.album,
      alias: null,
      aliases: ["Synthetic Alias Fallback"],
      artists: null,
      ar: [{ id: "720004", name: "Synthetic Artist Fallback" }],
      publishTime: null,
      releaseDate: "1704067200000",
      subType: null,
      subtype: "Synthetic Fallback Subtype",
      company: null,
      publishCompany: "Synthetic Company Fallback",
      picUrl: null,
      coverUrl: "https://example.invalid/synthetic-null-fallback.jpg",
      size: null,
      trackCount: "4",
      songs: [
        {
          id: "730004",
          name: "Synthetic Track Fallback",
          no: null,
          trackNumber: "7",
          cd: null,
          disc: "Disc 2",
          ar: null,
          artists: [{ id: "720004", name: "Synthetic Artist Fallback" }],
          dt: null,
          duration: "0",
        },
      ],
    });

    expect(result.data).toMatchObject({
      aliases: { state: "PRESENT", value: ["Synthetic Alias Fallback"] },
      artists: { state: "PRESENT", value: [{ name: { value: "Synthetic Artist Fallback" } }] },
      releaseTimestampMs: { state: "PRESENT", value: 1_704_067_200_000 },
      rawSubType: { state: "PRESENT", value: "Synthetic Fallback Subtype" },
      company: { state: "PRESENT", value: "Synthetic Company Fallback" },
      coverUrl: {
        state: "PRESENT",
        value: "https://example.invalid/synthetic-null-fallback.jpg",
      },
      reportedTrackCount: { state: "PRESENT", value: 4 },
      tracks: {
        state: "PRESENT",
        value: [
          {
            trackNumber: { state: "PRESENT", value: 7 },
            discNumber: { state: "PRESENT", value: 2 },
            artists: {
              state: "PRESENT",
              value: [{ name: { state: "PRESENT", value: "Synthetic Artist Fallback" } }],
            },
            durationMs: { state: "PRESENT", value: 0 },
          },
        ],
      },
    });
  });

  it("continues past an EXPLICIT_NULL aliases field to PRESENT transNames", () => {
    const result = parseNeteaseAlbumSource({
      id: "710030",
      name: "Synthetic Alias Middle Null Album",
      aliases: null,
      transNames: ["TransNames Fallback"],
      type: "Album",
    });

    expect(result.data?.aliases).toEqual({
      state: "PRESENT",
      value: ["TransNames Fallback"],
    });
    expect(result.data?.aliases).not.toEqual({ state: "EXPLICIT_NULL" });
    expect(result.data?.aliases).not.toEqual({ state: "PRESENT", value: [] });
    expect(result.issues).toEqual([]);
  });

  it("returns ABSENT when alias, aliases, and transNames are all ABSENT", () => {
    const result = parseNeteaseAlbumSource({
      id: "710031",
      name: "Synthetic Album Without Aliases",
      type: "Album",
    });

    expect(result.data?.aliases).toEqual({ state: "ABSENT" });
    expect(result.data?.aliases).not.toEqual({ state: "EXPLICIT_NULL" });
    expect(result.data?.aliases).not.toEqual({ state: "PRESENT", value: [] });
    expect(result.issues).toEqual([]);
  });

  it("stops at INVALID album and track candidates even when fallbacks are PRESENT", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumFallbackPayload.album,
      alias: { invalid: true },
      aliases: ["Synthetic Hidden Fallback"],
      artists: "invalid",
      ar: [{ id: "720005", name: "Synthetic Hidden Artist" }],
      publishTime: "invalid",
      releaseDate: "1704067200000",
      company: 17,
      publishCompany: "Synthetic Hidden Company",
      picUrl: { invalid: true },
      coverUrl: "https://example.invalid/hidden.jpg",
      songs: [
        {
          id: "730005",
          name: "Synthetic Invalid Track",
          no: { invalid: true },
          trackNumber: 1,
          cd: { invalid: true },
          disc: 1,
          ar: [],
          dt: { invalid: true },
          duration: 10,
        },
      ],
    });
    expect(result.data).toMatchObject({
      aliases: { state: "INVALID" },
      artists: { state: "INVALID" },
      releaseTimestampMs: { state: "INVALID" },
      company: { state: "INVALID" },
      coverUrl: { state: "INVALID" },
      tracks: {
        state: "PRESENT",
        value: [
          {
            trackNumber: { state: "INVALID" },
            discNumber: { state: "INVALID" },
            durationMs: { state: "INVALID" },
          },
        ],
      },
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "album.alias[0]", code: "INVALID_STRING_ITEM" }),
        expect.objectContaining({ path: "album.artists", code: "INVALID_ARTIST_LIST" }),
        expect.objectContaining({ path: "album.publishTime", code: "INVALID_INTEGER" }),
        expect.objectContaining({ path: "album.songs[0].no", code: "INVALID_INTEGER" }),
        expect.objectContaining({ path: "album.songs[0].dt", code: "INVALID_INTEGER" }),
      ]),
    );
    expect(result.data?.aliases).not.toEqual({
      state: "PRESENT",
      value: ["Synthetic Hidden Fallback"],
    });
  });

  it("prefers PRESENT alias and artist arrays over lower-priority arrays", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumFallbackPayload.album,
      alias: ["Synthetic Primary Alias"],
      aliases: ["Synthetic Backup Alias"],
      transNames: ["Synthetic Last Alias"],
      artists: [{ id: "720010", name: "Synthetic Primary Artist" }],
      ar: [{ id: "720011", name: "Synthetic Backup Artist" }],
    });

    expect(result.data?.aliases).toEqual({
      state: "PRESENT",
      value: ["Synthetic Primary Alias"],
    });
    expect(result.data?.artists).toMatchObject({
      state: "PRESENT",
      value: [{ externalArtistId: { state: "PRESENT", value: "720010" } }],
    });
  });

  it("prefers PRESENT track ar over PRESENT track artists", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: { id: "710040", name: "Synthetic Track Artist Priority Album", type: "Album" },
      songs: [
        {
          id: "730040",
          name: "Synthetic Track Artist Priority",
          no: 1,
          cd: 1,
          ar: [{ id: "720101", name: "track-ar-primary" }],
          artists: [{ id: "720102", name: "track-artists-fallback" }],
          dt: 1_000,
        },
      ],
    });

    if (result.data?.tracks.state !== "PRESENT") throw new Error("Expected PRESENT tracks.");
    const artists = result.data.tracks.value[0]?.artists;
    expect(artists).toEqual({
      state: "PRESENT",
      value: [
        {
          externalArtistId: { state: "PRESENT", value: "720101" },
          name: { state: "PRESENT", value: "track-ar-primary" },
        },
      ],
    });
    expect(JSON.stringify(artists)).not.toContain("track-artists-fallback");
    expect(result.issues).toEqual([]);
  });

  it("keeps a PRESENT empty track ar instead of falling back to track artists", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: { id: "710041", name: "Synthetic Empty Track Artist Album", type: "Album" },
      songs: [
        {
          id: "730041",
          name: "Synthetic Empty Track Artists",
          no: 1,
          cd: 1,
          ar: [],
          artists: [{ id: "720103", name: "track-artists-hidden" }],
          dt: 1_000,
        },
      ],
    });

    if (result.data?.tracks.state !== "PRESENT") throw new Error("Expected PRESENT tracks.");
    const artists = result.data.tracks.value[0]?.artists;
    expect(artists).toEqual({ state: "PRESENT", value: [] });
    expect(JSON.stringify(artists)).not.toContain("track-artists-hidden");
    expect(result.issues).toEqual([]);
  });

  it("stops at INVALID track ar instead of falling back to track artists", () => {
    const result = parseNeteaseAlbumDetailPayload({
      album: { id: "710042", name: "Synthetic Invalid Track Artist Album", type: "Album" },
      songs: [
        {
          id: "730042",
          name: "Synthetic Invalid Track Artists",
          no: 1,
          cd: 1,
          ar: "invalid",
          artists: [{ id: "720104", name: "track-artists-hidden-after-invalid" }],
          dt: 1_000,
        },
      ],
    });

    if (result.data?.tracks.state !== "PRESENT") throw new Error("Expected PRESENT tracks.");
    const artists = result.data.tracks.value[0]?.artists;
    expect(artists).toMatchObject({ state: "INVALID" });
    expect(artists).not.toEqual({
      state: "PRESENT",
      value: [{ name: { state: "PRESENT", value: "track-artists-hidden-after-invalid" } }],
    });
    expect(result.issues).toEqual([
      {
        path: "songs[0].ar",
        code: "INVALID_ARTIST_LIST",
        reason: "Expected an artist object or artist array.",
      },
    ]);
  });

  it("keeps PRESENT zero values instead of falling back", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumFallbackPayload.album,
      publishTime: 0,
      releaseDate: 1_704_067_200_000,
      size: 0,
      trackCount: 4,
      songs: [
        {
          ...syntheticAlbumFallbackPayload.album.songs[0],
          dt: 0,
          duration: 9_999,
        },
      ],
    });

    expect(result.data?.releaseTimestampMs).toEqual({ state: "PRESENT", value: 0 });
    expect(result.data?.reportedTrackCount).toEqual({ state: "PRESENT", value: 0 });
    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [{ durationMs: { state: "PRESENT", value: 0 } }],
    });
  });

  it("preserves a final EXPLICIT_NULL album field after absent fallbacks", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumDetailPayload.album,
      alias: null,
    });

    expect(result.data?.aliases).toEqual({ state: "EXPLICIT_NULL" });
  });

  it("keeps PRESENT empty field collections instead of using fallback values", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumFallbackPayload.album,
      alias: [],
      aliases: ["Synthetic Hidden Alias"],
      artists: [],
      ar: [{ id: "720006", name: "Synthetic Hidden Artist" }],
    });
    expect(result.data?.aliases).toEqual({ state: "PRESENT", value: [] });
    expect(result.data?.artists).toEqual({ state: "PRESENT", value: [] });
  });

  it("applies the same nullish rule to root songs and new-release list wrappers", () => {
    const detail = parseNeteaseAlbumDetailPayload({
      album: syntheticAlbumFallbackPayload.album,
      songs: null,
    });
    expect(detail.data?.tracks).toMatchObject({ state: "PRESENT", value: [{ sourcePosition: 1 }] });

    const releases = parseNeteaseNewReleasePayload(
      { albums: null, monthData: [fallbackAlbum] },
      {
        requestedMarketChannel: "ALL",
        sourceListEndpoint: "/synthetic/album/new",
        fetchedAt: "2026-07-17T00:00:00.000Z",
      },
    );
    expect(releases.data).toHaveLength(1);
  });
});

describe("SourceField state and failure behavior", () => {
  it("keeps explicit null, absent, and invalid values distinct", () => {
    const result = parseNeteaseAlbumSource(syntheticMalformedAlbumPayload);

    expect(result.data?.externalAlbumId.state).toBe("INVALID");
    expect(result.data?.title.state).toBe("EXPLICIT_NULL");
    expect(result.data?.rawSubType.state).toBe("ABSENT");
    expect(result.data?.coverUrl.state).toBe("ABSENT");
    expect(result.data?.aliases.state).toBe("INVALID");
    expect(result.data?.rawAlbumType).toEqual({
      state: "PRESENT",
      value: "SyntheticUnmappedFormat",
    });
  });

  it("never invents a missing source track number from array position", () => {
    const result = parseNeteaseAlbumSource(syntheticMalformedAlbumPayload);
    expect(result.data?.tracks).toMatchObject({
      state: "PRESENT",
      value: [
        {
          sourcePosition: 1,
          trackNumber: { state: "ABSENT" },
        },
      ],
    });
  });

  it("rejects unsafe numeric IDs without serializing their rounded value as identity", () => {
    const result = parseNeteaseAlbumSource(syntheticMalformedAlbumPayload);
    expect(result.data?.externalAlbumId).toMatchObject({ state: "INVALID" });
    expect(result.issues.map((item) => item.code)).toContain("UNSAFE_INTEGER");
  });

  it("reports stable paths and reasons without echoing invalid payload contents", () => {
    const result = parseNeteaseAlbumSource(syntheticMalformedAlbumPayload);
    const report = JSON.stringify(result.issues);
    expect(report).toContain("album.publishTime");
    expect(report).not.toContain("not-a-decimal-time");
    expect(report).not.toContain("Synthetic Track Without Source Number");
  });

  it("does not copy sensitive-looking keys or complete unknown payloads into issues", () => {
    const result = parseNeteaseAlbumSource({
      ...syntheticAlbumFallbackPayload.album,
      alias: {
        cookie: "synthetic-secret-value",
        authorization: "synthetic-sensitive-header",
        token: "synthetic-token-value",
      },
    });
    const report = JSON.stringify(result.issues);
    expect(report).not.toContain("synthetic-secret-value");
    expect(report).not.toContain("synthetic-sensitive-header");
    expect(report).not.toContain("synthetic-token-value");
    expect(report).not.toContain("authorization");
  });

  it("rejects non-canonical fetchedAt values with a structured issue", () => {
    const result = parseNeteaseNewReleasePayload(syntheticNewReleasePayload, {
      requestedMarketChannel: "ALL",
      sourceListEndpoint: "/synthetic/album/new",
      fetchedAt: "2026-07-17T00:00:00Z",
    });
    expect(result).toMatchObject({ data: null, issues: [{ code: "INVALID_FETCH_TIME" }] });
  });

  it("returns a controlled failure for a non-object root", () => {
    expect(parseNeteaseAlbumDetailPayload("invalid-root")).toMatchObject({
      data: null,
      issues: [{ path: "$", code: "INVALID_RESPONSE" }],
    });
  });

  it("is deterministic and does not mutate its input", () => {
    const input = structuredClone(syntheticAlbumDetailPayload);
    const before = structuredClone(input);
    const first = parseNeteaseAlbumDetailPayload(input);
    const second = parseNeteaseAlbumDetailPayload(input);
    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });

  it("validates a single new-release record context without network behavior", () => {
    const result = parseNeteaseNewReleaseRecord(syntheticAlbumDetailPayload.album, {
      requestedMarketChannel: "KR",
      sourceListEndpoint: "/synthetic/album/new",
      sourcePosition: 1,
      fetchedAt: "2026-07-17T00:00:00.000Z",
    });
    expect(result.data).toMatchObject({ requestedMarketChannel: "KR", sourcePosition: 1 });
  });
});
