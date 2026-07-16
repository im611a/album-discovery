import { describe, expect, it } from "vitest";

import { albumsMock } from "@/data/albums.mock";

import {
  DEFAULT_DISCOVER_STATE,
  buildDiscoverOptions,
  filterAndSortAlbums,
  getDiscoverTaxonomyHref,
  parseDiscoverQuery,
  serializeDiscoverState,
  type DiscoverState,
} from "./album-filters";

const options = buildDiscoverOptions(albumsMock);

function stateWith(patch: Partial<DiscoverState> = {}): DiscoverState {
  return { ...DEFAULT_DISCOVER_STATE, ...patch };
}

function valueFor(
  group: "primaryGenres" | "secondaryGenres" | "descriptors",
  label: string,
) {
  const value = options[group].find((option) => option.label === label)?.value;
  if (!value) throw new Error(`Missing test option: ${label}`);
  return value;
}

describe("album filters", () => {
  it("builds genre and descriptor options from the mock albums", () => {
    expect(options.primaryGenres.some((option) => option.label === "Art Pop")).toBe(true);
    expect(options.secondaryGenres.some((option) => option.label === "Ambient Pop")).toBe(
      true,
    );
    expect(options.descriptors.some((option) => option.label === "nocturnal")).toBe(true);

    const chineseOption = options.primaryGenres.find(
      (option) => option.label === "梦幻流行",
    );
    expect(chineseOption?.value).toMatch(/^primary-[a-z0-9]+$/);
  });

  it("returns every mock album with default filters", () => {
    expect(filterAndSortAlbums(albumsMock, stateWith(), options)).toHaveLength(18);
  });

  it("filters albums by decade", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ decade: "2010s" }),
      options,
    );

    expect(results).toHaveLength(3);
    expect(results.every((album) => album.releaseYear >= 2010 && album.releaseYear < 2020)).toBe(
      true,
    );
  });

  it("filters albums by release type", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ releaseType: "ep" }),
      options,
    );

    expect(results).toHaveLength(3);
    expect(results.every((album) => album.releaseType === "EP")).toBe(true);
  });

  it("filters albums by primary genre", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ primaryGenre: valueFor("primaryGenres", "Art Pop") }),
      options,
    );

    expect(results).toHaveLength(2);
    expect(results.every((album) => album.primaryGenres.includes("Art Pop"))).toBe(true);
  });

  it("filters albums by secondary genre", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ secondaryGenre: valueFor("secondaryGenres", "Ambient Pop") }),
      options,
    );

    expect(results.map((album) => album.title)).toEqual(["Before the Rain"]);
  });

  it("filters albums by descriptor", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ descriptor: valueFor("descriptors", "nocturnal") }),
      options,
    );

    expect(results.map((album) => album.title)).toEqual(["Mirror City"]);
  });

  it("sorts newest releases with stable date order", () => {
    const results = filterAndSortAlbums(albumsMock, stateWith(), options);

    expect(results[0].title).toBe("纸上月光");
    expect(results.at(-1)?.title).toBe("九号放映厅");
  });

  it("sorts oldest releases first", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ sort: "oldest" }),
      options,
    );

    expect(results[0].title).toBe("九号放映厅");
  });

  it("places unrated albums after rated albums when sorting by score", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ sort: "score" }),
      options,
    );
    const firstMissingScore = results.findIndex((album) => album.rymScore === null);

    expect(results[0].title).toBe("Night Bus to Nowhere");
    expect(firstMissingScore).toBe(16);
    expect(results.slice(firstMissingScore).every((album) => album.rymScore === null)).toBe(
      true,
    );
  });

  it("sorts by RYM rating count", () => {
    const results = filterAndSortAlbums(
      albumsMock,
      stateWith({ sort: "ratings" }),
      options,
    );

    expect(results[0].title).toBe("A Soft Place to Land");
    expect(results[0].rymRatingCount).toBe(15740);
  });

  it("serializes stable query parameters and omits defaults", () => {
    const query = serializeDiscoverState(
      stateWith({
        decade: "2020s",
        releaseType: "album",
        primaryGenre: valueFor("primaryGenres", "Art Pop"),
        sort: "score",
      }),
    );

    expect(query).toBe("decade=2020s&type=album&primaryGenre=art-pop&sort=score");
    expect(serializeDiscoverState(DEFAULT_DISCOVER_STATE)).toBe("");
  });

  it("falls back safely when URL parameters are invalid", () => {
    const state = parseDiscoverQuery(
      new URLSearchParams(
        "decade=tomorrow&type=single&primaryGenre=unknown&sort=popular",
      ),
      options,
    );

    expect(state).toEqual(DEFAULT_DISCOVER_STATE);
  });

  it("builds taxonomy links with stable source values", () => {
    expect(getDiscoverTaxonomyHref("primaryGenre", "Art Pop")).toBe(
      "/discover?primaryGenre=art-pop",
    );
    expect(getDiscoverTaxonomyHref("secondaryGenre", "Ambient Pop")).toBe(
      "/discover?secondaryGenre=ambient-pop",
    );
    expect(getDiscoverTaxonomyHref("descriptor", "introspective")).toBe(
      "/discover?descriptor=introspective",
    );
  });

  it("does not use translated labels as taxonomy parameter values", () => {
    const href = getDiscoverTaxonomyHref("primaryGenre", "Art Pop");

    expect(href).not.toContain("艺术流行");
  });
});
