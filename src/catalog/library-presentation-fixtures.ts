import { buildLibraryProjection, type LibraryQuery } from "./collection-presentation";
import { buildLibraryPresentationModel, type LibraryPresentationContext, type LibraryPresentationModel } from "./library-presentation-model";
import type { PublishedAlbumSummary } from "./schema";

export const LIBRARY_PRESENTATION_FIXTURE_NAMES = [
  "library-empty",
  "library-single",
  "library-small",
  "library-medium",
  "library-dense",
  "library-favorites",
  "library-saved",
  "library-listened",
  "library-mixed-state",
  "library-recent-only",
  "library-collection-plus-recent",
  "library-stale-reconciled",
  "library-long-titles",
  "library-multi-artist",
  "library-cjk-metadata",
  "library-mobile-dense",
] as const;

export type LibraryPresentationFixtureName = (typeof LIBRARY_PRESENTATION_FIXTURE_NAMES)[number];

export const LIBRARY_PRESENTATION_GOLDEN_CASES = Object.freeze([
  "library-empty",
  "library-single",
  "library-dense",
  "library-favorites",
  "library-saved",
  "library-listened",
  "library-mixed-state",
  "library-recent-only",
  "library-collection-plus-recent",
  "library-long-titles",
  "library-multi-artist",
  "library-cjk-metadata",
] as const satisfies readonly LibraryPresentationFixtureName[]);

export interface LibraryPresentationFixture {
  readonly name: LibraryPresentationFixtureName;
  readonly description: string;
  readonly reviewViewport: 390 | 1280;
  readonly state: unknown;
  readonly query: LibraryQuery;
  readonly context: LibraryPresentationContext;
  readonly model: LibraryPresentationModel;
}

function select(catalog: readonly PublishedAlbumSummary[], slug: string, fallbackIndex: number) {
  return catalog.find((album) => album.slug === slug) ?? catalog[fallbackIndex % catalog.length];
}

function state(values: Record<string, unknown> = {}) {
  return { version: 1, savedAlbumIds: [], likedAlbumIds: [], favoriteAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], recommendationFeedback: {}, ...values };
}

function query(view: LibraryQuery["view"] = "overview", queryValue = "", sort: LibraryQuery["sort"] = "catalog"): LibraryQuery {
  return Object.freeze({ view, query: queryValue, sort });
}

export function buildLibraryPresentationFixtures(catalog: readonly PublishedAlbumSummary[]): readonly LibraryPresentationFixture[] {
  if (catalog.length === 0) throw new Error("R15 Library fixtures require the real published catalog.");
  const ids = catalog.map((album) => album.id);
  const longTitle = select(catalog, "netease-34887555", 0);
  const multiArtist = select(catalog, "netease-272136228", 1);
  const cjk = select(catalog, "fantasy-jay-chou", 2);
  const definitions: readonly Readonly<{
    name: LibraryPresentationFixtureName;
    description: string;
    reviewViewport?: 390 | 1280;
    state: unknown;
    query?: LibraryQuery;
    context?: LibraryPresentationContext;
  }>[] = [
    { name: "library-empty", description: "No durable membership or recent browsing.", state: state() },
    { name: "library-single", description: "One saved real album.", state: state({ savedAlbumIds: ids.slice(0, 1) }), query: query("saved") },
    { name: "library-small", description: "Four retained real albums.", state: state({ savedAlbumIds: ids.slice(0, 4) }) },
    { name: "library-medium", description: "Sixteen retained real albums.", state: state({ savedAlbumIds: ids.slice(0, 16) }) },
    { name: "library-dense", description: "One hundred twenty-eight retained real albums.", state: state({ savedAlbumIds: ids.slice(0, 128) }) },
    { name: "library-favorites", description: "Favorite facet with exact explicit state.", state: state({ favoriteAlbumIds: ids.slice(2, 10) }), query: query("favorite") },
    { name: "library-saved", description: "Saved facet with real catalog order.", state: state({ savedAlbumIds: ids.slice(4, 12) }), query: query("saved") },
    { name: "library-listened", description: "Explicit marked-listened facts only.", state: state({ listenedAlbumIds: ids.slice(6, 14) }), query: query("listened") },
    { name: "library-mixed-state", description: "Overlapping explicit states on canonical albums.", state: state({ savedAlbumIds: ids.slice(0, 8), likedAlbumIds: ids.slice(2, 10), favoriteAlbumIds: ids.slice(4, 12), listenedAlbumIds: ids.slice(6, 14) }) },
    { name: "library-recent-only", description: "Browsing return with no durable membership.", state: state({ recentAlbumIds: ids.slice(0, 12) }), query: query("recent") },
    { name: "library-collection-plus-recent", description: "Durable collection and independent recent browsing.", state: state({ savedAlbumIds: ids.slice(0, 8), recentAlbumIds: ids.slice(6, 18) }) },
    { name: "library-stale-reconciled", description: "Unresolved legacy IDs produce no fallback card.", state: state({ savedAlbumIds: ["album:stale"] }), context: { recoveryKind: "STALE_REFERENCES_RECONCILED" } },
    { name: "library-long-titles", description: "Real long-title catalog case.", state: state({ savedAlbumIds: [longTitle.id] }), query: query("saved") },
    { name: "library-multi-artist", description: "Real multi-credit catalog case.", state: state({ favoriteAlbumIds: [multiArtist.id] }), query: query("favorite") },
    { name: "library-cjk-metadata", description: "Real CJK title and artist metadata.", state: state({ savedAlbumIds: [cjk.id] }), query: query("saved") },
    { name: "library-mobile-dense", description: "Dense semantic model reviewed at 390px priority.", reviewViewport: 390, state: state({ savedAlbumIds: ids.slice(0, 64), favoriteAlbumIds: ids.slice(32, 96), recentAlbumIds: ids.slice(80, 105) }) },
  ];

  return Object.freeze(definitions.map((definition) => {
    const fixtureQuery = definition.query ?? query();
    const context = Object.freeze(definition.context ?? {});
    const model = buildLibraryPresentationModel({
      projection: buildLibraryProjection({ catalog, state: definition.state, query: fixtureQuery }),
      catalog,
      context,
    });
    return Object.freeze({
      name: definition.name,
      description: definition.description,
      reviewViewport: definition.reviewViewport ?? 1280,
      state: definition.state,
      query: fixtureQuery,
      context,
      model,
    });
  }));
}
