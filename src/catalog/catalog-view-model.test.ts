import { describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { catalogAlbums } from "./published-catalog";
import { buildCatalogViewModel, parseCatalogQuery, serializeCatalogQuery } from "./catalog-view-model";

describe("catalog view model foundation", () => {
  it("accepts all 1,330 published albums and preserves stable identity", () => {
    expect(catalogAlbums).toHaveLength(1_330);
    const query = parseCatalogQuery("", catalogAlbums);
    const view = buildCatalogViewModel({ albums: catalogAlbums, query });
    expect(view.resultCount).toBe(1_330);
    expect(new Set(view.albums.map((album) => album.id)).size).toBe(1_330);
    expect(new Set(view.albums.map((album) => album.slug)).size).toBe(1_330);
  });

  it("combines search, primary genre, secondary genre, scene, decade and release type", () => {
    const source = catalogAlbums.find((album) =>
      album.coreGenres.length && album.relatedGenres.length && album.contexts.length && album.releaseDate,
    );
    expect(source).toBeDefined();
    const params = new URLSearchParams({
      q: source?.artists[0].name ?? "",
      core: source?.coreGenres[0] ?? "",
      related: source?.relatedGenres[0] ?? "",
      scene: source?.contexts[0] ?? "",
      decade: `${Math.floor((source?.releaseYear ?? 0) / 10) * 10}s`,
      type: source?.albumType ?? "ALBUM",
      sort: "release-newest",
    });
    const view = buildCatalogViewModel({
      albums: catalogAlbums,
      query: parseCatalogQuery(params, catalogAlbums),
    });
    expect(view.albums.some((album) => album.id === source?.id)).toBe(true);
    expect(view.albums.every((album) => album.contexts.includes(source?.contexts[0] ?? ""))).toBe(true);
  });

  it("filters using existing personal-state collections without changing their schema", () => {
    const selected = catalogAlbums[0];
    const state = { ...createInitialUserState(), savedAlbumIds: [selected.id] };
    const query = parseCatalogQuery("status=saved", catalogAlbums);
    const view = buildCatalogViewModel({ albums: catalogAlbums, query, userState: state });
    expect(view.albums.map((album) => album.id)).toEqual([selected.id]);
  });

  it("round-trips URL state in a stable parameter order", () => {
    const parsed = parseCatalogQuery(
      "sort=rym-rating-desc&type=album&scene=night&q=%E7%8E%8B%E8%8F%B2&status=liked&rym=rated",
      catalogAlbums,
    );
    expect(serializeCatalogQuery(parsed)).toBe("q=%E7%8E%8B%E8%8F%B2&scene=night&type=album&rym=rated&status=liked&sort=rym-rating-desc");
    expect(parseCatalogQuery(serializeCatalogQuery(parsed), catalogAlbums)).toEqual(parsed);
  });

  it("safely ignores invalid URL values and produces an explicit empty model", () => {
    const invalid = parseCatalogQuery("core=not-real&type=BOOTLEG&status=unknown&sort=not-real", catalogAlbums);
    expect(invalid).toEqual({
      query: "",
      filters: {
        coreGenre: null,
        relatedGenre: null,
        context: null,
        decade: null,
        releaseType: null,
        editorialOnly: false,
        rymRatedOnly: false,
      },
      userStatus: null,
      sort: "recently-added",
    });
    const impossible = { ...invalid, query: "this album cannot exist 3a8f6d1b" };
    const view = buildCatalogViewModel({ albums: catalogAlbums, query: impossible });
    expect(view).toMatchObject({ resultCount: 0, empty: true });
    expect(view.emptyMessage).toMatch(/没有专辑/);
  });

  it("keeps scenes independent from compatibility descriptors", () => {
    const album = catalogAlbums.find((item) => item.contexts.length);
    expect(album).toBeDefined();
    const view = buildCatalogViewModel({
      albums: catalogAlbums,
      query: parseCatalogQuery(`scene=${encodeURIComponent(album?.contexts[0] ?? "")}`, catalogAlbums),
    });
    expect(view.albums.every((item) => item.contexts.includes(album?.contexts[0] ?? ""))).toBe(true);
  });

  it("keeps verified RYM sorting and presence filtering explicit", () => {
    const query = parseCatalogQuery("sort=rym-rating-desc&rym=rated", catalogAlbums);
    const view = buildCatalogViewModel({ albums: catalogAlbums, query });
    expect(view.resultCount).toBe(13);
    expect(view.albums.every((album) => album.rymRating != null)).toBe(true);
    expect(view.albums.map((album) => album.rymRating)).toEqual([...view.albums].map((album) => album.rymRating).sort((a, b) => (b ?? 0) - (a ?? 0)));
  });
});
