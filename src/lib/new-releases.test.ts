import { describe, expect, it } from "vitest";

import { albumsMock, type MockAlbum } from "@/data/albums.mock";
import {
  newReleaseSourceContextMock,
  type MarketChannel,
  type MockNewReleaseSourceContext,
} from "@/data/new-releases.mock";

import {
  DEFAULT_NEW_RELEASE_STATE,
  MARKET_CHANNEL_OPTIONS,
  parseNewReleaseQuery,
  selectNewReleaseAlbums,
  serializeNewReleaseState,
  type NewReleaseState,
} from "./new-releases";

function stateWith(patch: Partial<NewReleaseState> = {}): NewReleaseState {
  return { ...DEFAULT_NEW_RELEASE_STATE, ...patch };
}

describe("new release catalog", () => {
  it("uses ALL as the default channel", () => {
    expect(parseNewReleaseQuery(new URLSearchParams())).toEqual(
      DEFAULT_NEW_RELEASE_STATE,
    );
  });

  it.each([
    ["ZH", 8],
    ["EA", 8],
    ["JP", 5],
    ["KR", 4],
  ] as const)("filters the %s market channel", (channel, expectedCount) => {
    const results = selectNewReleaseAlbums(
      albumsMock,
      newReleaseSourceContextMock,
      stateWith({ channel }),
    );

    expect(results).toHaveLength(expectedCount);
    expect(
      results.every((album) =>
        newReleaseSourceContextMock.some(
          (source) =>
            source.albumId === album.id && source.sourceMarketChannel === channel,
        ),
      ),
    ).toBe(true);
  });

  it("deduplicates albums found through more than one channel on ALL", () => {
    const results = selectNewReleaseAlbums(
      albumsMock,
      newReleaseSourceContextMock,
      stateWith(),
    );

    expect(results).toHaveLength(18);
    expect(new Set(results.map((album) => album.id))).toHaveLength(18);
  });

  it("allows one album to retain multiple source channel records", () => {
    const channels = newReleaseSourceContextMock
      .filter((source) => source.albumId === "mock-018")
      .map((source) => source.sourceMarketChannel);

    expect(channels).toEqual(expect.arrayContaining(["ALL", "ZH", "EA", "JP"]));
  });

  it("filters by release type", () => {
    const results = selectNewReleaseAlbums(
      albumsMock,
      newReleaseSourceContextMock,
      stateWith({ releaseType: "ep" }),
    );

    expect(results).toHaveLength(3);
    expect(results.every((album) => album.releaseType === "EP")).toBe(true);
  });

  it("combines a channel and release type filter", () => {
    const results = selectNewReleaseAlbums(
      albumsMock,
      newReleaseSourceContextMock,
      stateWith({ channel: "ZH", releaseType: "ep" }),
    );

    expect(results.map((album) => album.id)).toEqual(["mock-008"]);
  });

  it("falls back from invalid channel and type parameters", () => {
    expect(
      parseNewReleaseQuery(
        new URLSearchParams("channel=domestic&type=single"),
      ),
    ).toEqual(DEFAULT_NEW_RELEASE_STATE);
  });

  it("restores valid URL parameters without replacing internal values", () => {
    const state = parseNewReleaseQuery(
      new URLSearchParams("channel=jp&type=soundtrack"),
    );

    expect(state).toEqual({ channel: "JP", releaseType: "soundtrack" });
    expect(serializeNewReleaseState(state)).toBe("channel=jp&type=soundtrack");
    expect(MARKET_CHANNEL_OPTIONS.map((option) => option.value)).toEqual([
      "ALL",
      "ZH",
      "EA",
      "JP",
      "KR",
    ] satisfies MarketChannel[]);
  });

  it("sorts every result from newest to oldest", () => {
    const results = selectNewReleaseAlbums(
      albumsMock,
      newReleaseSourceContextMock,
      stateWith(),
    );

    expect(
      results.every(
        (album, index) =>
          index === 0 || results[index - 1].releaseDate >= album.releaseDate,
      ),
    ).toBe(true);
  });

  it("uses title as a stable secondary sort for matching dates", () => {
    const albums: MockAlbum[] = [
      { ...albumsMock[0], id: "tie-b", title: "B Album", releaseDate: "2026-01-01" },
      { ...albumsMock[1], id: "tie-a", title: "A Album", releaseDate: "2026-01-01" },
    ];
    const sources: MockNewReleaseSourceContext[] = albums.map((album) => ({
      albumId: album.id,
      sourceMarketChannel: "ALL",
      sourceListEndpoint: "mock:new-releases:ALL",
      discoveredAt: "2026-07-16T00:00:00.000Z",
    }));

    expect(
      selectNewReleaseAlbums(albums, sources, stateWith()).map(
        (album) => album.title,
      ),
    ).toEqual(["A Album", "B Album"]);
  });
});
