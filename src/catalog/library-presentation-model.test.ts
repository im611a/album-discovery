import { describe, expect, it } from "vitest";

import { createInitialUserState } from "@/features/personal-state/schema";

import { buildLibraryProjection, type LibraryProjection } from "./collection-presentation";
import {
  buildLibraryPresentationFixtures,
  LIBRARY_PRESENTATION_FIXTURE_NAMES,
  LIBRARY_PRESENTATION_GOLDEN_CASES,
} from "./library-presentation-fixtures";
import { buildLibraryPresentationModel, LIBRARY_RESPONSIVE_CONTENT_PRIORITY, type LibraryPresentationModel } from "./library-presentation-model";
import { catalogAlbums } from "./published-catalog";

const albums = catalogAlbums;
const ids = albums.map((album) => album.id);

function stateWith(values: Partial<ReturnType<typeof createInitialUserState>>) {
  return { ...createInitialUserState(), ...values };
}

function model(state: unknown, query = "", context = {}) {
  return buildLibraryPresentationModel({
    projection: buildLibraryProjection({ catalog: albums, state, query }),
    catalog: albums,
    context,
  });
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function signature(value: LibraryPresentationModel) {
  return JSON.stringify(value, (key, item) => key === "album" ? { id: item.id, slug: item.slug } : item);
}

describe("R15-2B Library presentation information architecture", () => {
  it("builds a truthful empty orientation with real exits and no fake personal shelf", () => {
    const result = model(null);
    expect(result.pageEmptyState).toMatchObject({ kind: "FRESH_LIBRARY", title: "从一张想再次找到的专辑开始" });
    expect(result.pageEmptyState?.actions.map((item) => item.href)).toEqual(["/discover", "/for-you", "/search"]);
    expect(result.primaryCollection.entries).toEqual([]);
    expect(result.recent.entries).toEqual([]);
  });

  it("presents one canonical collection item with minimal truthful card facts", () => {
    const result = model(stateWith({ savedAlbumIds: [ids[0]] }), "view=saved");
    const item = result.primaryCollection.entries[0];
    expect(item).toMatchObject({ albumId: ids[0], slug: albums[0].slug, title: albums[0].title, releaseTypeLabel: expect.any(String) });
    expect(item.album).toBe(albums[0]);
    expect(item.statuses.map((status) => status.key)).toEqual(["SAVED"]);
    expect(item.accessibleLabel).toContain("已加入想听");
  });

  it("keeps saved, liked, favorite and marked-listened labels distinct", () => {
    const result = model(stateWith({
      savedAlbumIds: [ids[0]], likedAlbumIds: [ids[0]], favoriteAlbumIds: [ids[0]], listenedAlbumIds: [ids[0]],
    }), "view=all");
    expect(result.primaryCollection.entries[0].statuses).toEqual([
      expect.objectContaining({ key: "SAVED", label: "想听" }),
      expect.objectContaining({ key: "LIKED", label: "喜欢" }),
      expect.objectContaining({ key: "FAVORITE", label: "收藏" }),
      expect.objectContaining({ key: "MARKED_LISTENED", label: "标记听过" }),
    ]);
  });

  it("models recent browsing separately without creating durable membership", () => {
    const result = model(stateWith({ recentAlbumIds: [ids[2], ids[1]] }));
    expect(result.summary.facts.find((fact) => fact.key === "total")?.value).toBe(0);
    expect(result.recent).toMatchObject({ kind: "RECENT_BROWSING", visible: true, independentOfCollectionFacet: true, count: 2 });
    expect(result.recent.entries.map((entry) => entry.albumId)).toEqual([ids[2], ids[1]]);
    expect(result.recent.entries.every((entry) => entry.statuses.length === 0)).toBe(true);
  });

  it("allows the same album in collection and recent without collapsing semantic sections", () => {
    const result = model(stateWith({ savedAlbumIds: [ids[0]], recentAlbumIds: [ids[0]] }));
    expect(result.primaryCollection.entries[0].albumId).toBe(ids[0]);
    expect(result.recent.entries[0].albumId).toBe(ids[0]);
    expect(result.primaryCollection.kind).toBe("DURABLE_COLLECTION");
    expect(result.recent.kind).toBe("RECENT_BROWSING");
  });

  it.each([
    ["all", "COLLECTION"], ["saved", "COLLECTION"], ["liked", "COLLECTION"],
    ["favorite", "COLLECTION"], ["listened", "COLLECTION"], ["dismissed", "REVIEW"], ["recent", "ACTIVITY"],
  ] as const)("exposes the %s facet with stable count, href and group", (view, group) => {
    const result = model(stateWith({ savedAlbumIds: [ids[0]] }), `view=${view}`);
    const facet = result.facets.find((item) => item.key === view)!;
    expect(facet).toMatchObject({ group, selected: true, zeroCountBehavior: "VISIBLE" });
    expect(facet.href).toContain(`view=${view}`);
    expect(facet.accessibleLabel).toContain("当前分类");
  });

  it("keeps every zero-count facet visible by explicit rule", () => {
    const result = model(null);
    expect(result.facets).toHaveLength(7);
    expect(result.facets.every((facet) => facet.count === 0 && facet.zeroCountBehavior === "VISIBLE")).toBe(true);
  });

  it("maps exact summary counts without qualitative profiling", () => {
    const result = model(stateWith({ savedAlbumIds: ids.slice(0, 3), favoriteAlbumIds: ids.slice(1, 4), listenedAlbumIds: [ids[4]], recentAlbumIds: ids.slice(0, 5) }));
    expect(Object.fromEntries(result.summary.facts.map((fact) => [fact.key, fact.value]))).toEqual({
      total: 5, saved: 3, liked: 0, favorite: 3, "marked-listened": 1, recent: 5,
    });
    expect(strings(result.summary).join(" ")).not.toMatch(/人格|心情|最喜欢的流派|最爱年代/);
  });

  it("creates canonical Album and Artist links with bounded Library context", () => {
    const item = model(stateWith({ savedAlbumIds: [ids[0]] }), "view=saved").primaryCollection.entries[0];
    expect(item.href).toBe(`/albums/${albums[0].slug}?lfrom=library&lview=saved`);
    expect(item.href).not.toMatch(/q=|pfrom|ptrail|album%3A/);
    expect(item.artists.every((artist) => artist.href.startsWith("/artists/artist-") && artist.href.includes("lfrom=library") && artist.href.includes("lview=saved"))).toBe(true);
  });

  it("uses separate dismissed-review semantics without positive affinity copy", () => {
    const result = model(stateWith({ dismissedAlbumIds: [ids[0]] }), "view=dismissed");
    expect(result.primaryCollection.kind).toBe("DISMISSED_REVIEW");
    expect(result.primaryCollection.entries[0].statuses).toEqual([expect.objectContaining({ key: "DISMISSED", tone: "negative" })]);
    expect(result.primaryCollection.heading).toContain("复核");
  });

  it("does not apply collection facet filtering to the independent recent source", () => {
    const state = stateWith({ favoriteAlbumIds: [ids[0]], recentAlbumIds: [ids[1], ids[0]] });
    const favorite = model(state, "view=favorite");
    const overview = model(state);
    expect(favorite.recent.visible).toBe(false);
    expect(overview.recent.entries.map((entry) => entry.albumId)).toEqual([ids[1], ids[0]]);
    expect(overview.recent.independentOfCollectionFacet).toBe(true);
  });

  it("provides distinct no-match, empty-facet, empty-recent, stale and recovered states", () => {
    expect(model(stateWith({ savedAlbumIds: [ids[0]] }), "view=saved&q=missing-title").primaryCollection.emptyState?.kind).toBe("NO_QUERY_MATCH");
    expect(model(stateWith({ savedAlbumIds: [ids[0]] }), "view=favorite").primaryCollection.emptyState?.kind).toBe("EMPTY_COLLECTION_FACET");
    expect(model(stateWith({ savedAlbumIds: [ids[0]] }), "view=recent").recent.emptyState?.kind).toBe("NO_RECENT_VIEWS");
    expect(model({ savedAlbumIds: ["missing"] }, "", { recoveryKind: "STALE_REFERENCES_RECONCILED" }).pageEmptyState?.kind).toBe("STALE_REFERENCES_RECONCILED");
    expect(model("corrupt", "", { recoveryKind: "LOCAL_STATE_RECOVERED" }).pageEmptyState?.kind).toBe("LOCAL_STATE_RECOVERED");
  });

  it("reports storage-unavailable truth without promising persistence", () => {
    const result = model(null, "", { recoveryKind: "STORAGE_UNAVAILABLE" });
    expect(result.header.localOnlyNote).toContain("无法确认持久保存");
    expect(result.header.localOnlyNote).not.toContain("已永久保存");
  });

  it("keeps recent wording truthful and classifies playback words only as explicit negation", () => {
    const result = model(stateWith({ recentAlbumIds: [ids[0]] }), "view=recent");
    const copy = strings(result).join(" ");
    expect(copy).not.toMatch(/最近播放|最近收听|播放历史|根据你的收听|你常听|为你精选/);
    expect(result.recent.description).toContain("最近打开过的专辑页面");
    expect(result.recent.description).toContain("不因此进入保留清单");
  });

  it("supports long titles, multi-credit artists, CJK metadata and missing optional release year", () => {
    const fixtures = buildLibraryPresentationFixtures(albums);
    const long = fixtures.find((fixture) => fixture.name === "library-long-titles")!.model.primaryCollection.entries[0];
    const multi = fixtures.find((fixture) => fixture.name === "library-multi-artist")!.model.primaryCollection.entries[0];
    const cjk = fixtures.find((fixture) => fixture.name === "library-cjk-metadata")!.model.primaryCollection.entries[0];
    expect(long.title.length).toBeGreaterThan(40);
    expect(multi.artists.length).toBeGreaterThan(1);
    expect(cjk.title).toMatch(/[\u3400-\u9fff]/u);
    const missingAlbum = { ...albums[0], releaseYear: null, releaseDate: null };
    const missing = buildLibraryPresentationModel({
      projection: buildLibraryProjection({ catalog: [missingAlbum], state: { savedAlbumIds: [missingAlbum.id] }, query: "view=saved" }),
      catalog: [missingAlbum],
    });
    expect(missing.primaryCollection.entries[0].releaseYearLabel).toBe("发行年份暂缺");
  });

  it("provides stable accessible labels and content priorities for future native controls and links", () => {
    const result = model(stateWith({ savedAlbumIds: [ids[0]] }));
    expect(result.header.title).toBe("我的专辑");
    expect(result.summary.accessibleLabel).toContain("当前设备");
    expect(result.facets.every((facet) => facet.accessibleLabel.length > 0)).toBe(true);
    expect(result.primaryCollection.entries[0].contentPriority).toMatchObject({ cover: "ESSENTIAL", title: "ESSENTIAL", state: "SECONDARY" });
    expect(LIBRARY_RESPONSIVE_CONTENT_PRIORITY.viewports).toEqual([390, 768, 1024, 1280, 1440, 2048]);
  });

  it("defensively deduplicates an already-projected canonical entry without mutating input", () => {
    const projection = buildLibraryProjection({ catalog: albums, state: stateWith({ savedAlbumIds: [ids[0], ids[1]] }), query: "view=saved" });
    const duplicateProjection = { ...projection, entries: [projection.entries[0], projection.entries[0], projection.entries[1]] } as LibraryProjection;
    const before = JSON.stringify(duplicateProjection);
    const result = buildLibraryPresentationModel({ projection: duplicateProjection, catalog: albums });
    expect(result.primaryCollection.entries.map((entry) => entry.albumId)).toEqual([ids[0], ids[1]]);
    expect(JSON.stringify(duplicateProjection)).toBe(before);
  });

  it("tolerates R14 legacy and unsupported future state through the canonical foundation", () => {
    const legacy = model({ favoriteAlbumIds: [ids[0]], futurePresentationFact: "ignored" }, "view=favorite");
    expect(legacy.primaryCollection.entries[0].statuses.map((status) => status.key)).toContain("FAVORITE");
    expect(strings(legacy).join(" ")).not.toContain("futurePresentationFact");
  });

  it("replays byte-equivalent canonical presentation and preserves catalog/projection inputs", () => {
    const state = stateWith({ savedAlbumIds: ids.slice(0, 8), favoriteAlbumIds: ids.slice(3, 10), recentAlbumIds: ids.slice(5, 15) });
    const projection = buildLibraryProjection({ catalog: albums, state, query: "view=all&sort=title" });
    const catalogBefore = JSON.stringify(albums);
    const projectionBefore = JSON.stringify(projection);
    const first = buildLibraryPresentationModel({ projection, catalog: albums });
    const second = buildLibraryPresentationModel({ projection, catalog: albums });
    expect(signature(first)).toBe(signature(second));
    expect(JSON.stringify(albums)).toBe(catalogBefore);
    expect(JSON.stringify(projection)).toBe(projectionBefore);
  });
});

describe("R15-2B deterministic real-catalog presentation fixtures", () => {
  it("builds all required density and semantic fixtures from the real 345-album catalog", () => {
    const fixtures = buildLibraryPresentationFixtures(albums);
    expect(albums).toHaveLength(345);
    expect(fixtures.map((fixture) => fixture.name)).toEqual(LIBRARY_PRESENTATION_FIXTURE_NAMES);
    expect(fixtures).toHaveLength(16);
    expect(LIBRARY_PRESENTATION_GOLDEN_CASES).toHaveLength(12);
    expect(fixtures.find((fixture) => fixture.name === "library-mobile-dense")?.reviewViewport).toBe(390);
    expect(fixtures.find((fixture) => fixture.name === "library-dense")?.model.primaryCollection.count).toBe(128);
  });

  it("runs 20,000 scenarios and 120,000 facet projections with zero presentation failures", () => {
    let seed = 1520;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const sample = (length: number, stale = false) => Array.from({ length }, (_, index) => stale && index % 11 === 0 ? `stale:${index}` : ids[Math.floor(random() * ids.length)]);
    const views = ["all", "saved", "favorite", "listened", "dismissed", "recent"] as const;
    const failures = {
      exceptions: 0, invalidAlbumLinks: 0, duplicateCollectionEntries: 0, invalidCovers: 0,
      falsePlaybackListeningClaims: 0, incorrectFacetCounts: 0, summaryMismatches: 0,
      nondeterministicPresentationOutputs: 0, unboundedSections: 0, brokenAccessibleLabels: 0,
    };
    const validSlugs = new Set(albums.map((album) => album.slug));
    const forbiddenClaims = /最近播放|最近收听|播放历史|根据你的收听|你常听|你最喜欢|最爱|为你精选/;
    let projections = 0;
    for (let scenario = 0; scenario < 20_000; scenario += 1) {
      const overlap = sample(scenario % 9, true);
      const dismissed = sample(scenario % 13, true);
      const scenarioState: unknown = scenario % 17 === 0
        ? { savedAlbumIds: "malformed", recentAlbumIds: [null, ...sample(30, true)], future: true }
        : {
          savedAlbumIds: [...overlap, ...sample(scenario % 41, true), ...overlap],
          likedAlbumIds: [...overlap, ...sample(scenario % 31, true)],
          favoriteAlbumIds: [...overlap, ...sample(scenario % 29, true)],
          listenedAlbumIds: [...sample(scenario % 23, true), ...dismissed.slice(0, 2)],
          dismissedAlbumIds: dismissed,
          recentAlbumIds: [...sample(35, true), ...overlap],
          recommendationFeedback: Object.fromEntries(dismissed.map((id) => [id, "not_for_me"])),
        };
      for (const view of views) {
        try {
          const domain = buildLibraryProjection({ catalog: albums, state: scenarioState, query: `view=${view}&sort=${scenario % 2 ? "title" : "catalog"}` });
          const first = buildLibraryPresentationModel({ projection: domain, catalog: albums });
          const replay = buildLibraryPresentationModel({ projection: domain, catalog: albums });
          projections += 1;
          const section = view === "recent" ? first.recent : first.primaryCollection;
          failures.invalidAlbumLinks += section.entries.filter((entry) => !validSlugs.has(entry.slug) || !entry.href.startsWith(`/albums/${entry.slug}?lfrom=library`)).length;
          if (new Set(section.entries.map((entry) => entry.albumId)).size !== section.entries.length) failures.duplicateCollectionEntries += 1;
          failures.invalidCovers += section.entries.filter((entry) => !entry.cover.alt || (entry.cover.kind === "local" && !entry.cover.src)).length;
          if (strings(first).some((copy) => forbiddenClaims.test(copy))) failures.falsePlaybackListeningClaims += 1;
          if (first.facets.some((facet) => facet.count !== domain.facets.find((source) => source.facet === facet.key)?.count)) failures.incorrectFacetCounts += 1;
          const facts = Object.fromEntries(first.summary.facts.map((fact) => [fact.key, fact.value]));
          if (facts.total !== domain.summary.totalLibraryAlbums || facts.saved !== domain.summary.savedCount || facts.favorite !== domain.summary.favoriteCount || facts["marked-listened"] !== domain.summary.markedListenedCount || facts.recent !== domain.summary.recentlyViewedCount) failures.summaryMismatches += 1;
          if (signature(first) !== signature(replay)) failures.nondeterministicPresentationOutputs += 1;
          if (first.primaryCollection.entries.length > albums.length || first.recent.entries.length > 20) failures.unboundedSections += 1;
          failures.brokenAccessibleLabels += section.entries.filter((entry) => !entry.accessibleLabel || !entry.cover.alt).length + first.facets.filter((facet) => !facet.accessibleLabel).length;
        } catch {
          failures.exceptions += 1;
        }
      }
    }
    console.info("R15_2B_PRESENTATION_SIMULATION", JSON.stringify({ scenarios: 20_000, projections, ...failures }));
    expect(projections).toBe(120_000);
    expect(failures).toEqual({
      exceptions: 0, invalidAlbumLinks: 0, duplicateCollectionEntries: 0, invalidCovers: 0,
      falsePlaybackListeningClaims: 0, incorrectFacetCounts: 0, summaryMismatches: 0,
      nondeterministicPresentationOutputs: 0, unboundedSections: 0, brokenAccessibleLabels: 0,
    });
  }, 180_000);

  it("measures bounded presentation adaptation for empty through dense inputs", () => {
    const fixtureByName = new Map(buildLibraryPresentationFixtures(albums).map((fixture) => [fixture.name, fixture]));
    const names = ["library-empty", "library-small", "library-medium", "library-dense", "library-mobile-dense"] as const;
    const timings = Object.fromEntries(names.map((name) => {
      const fixture = fixtureByName.get(name)!;
      const projection = buildLibraryProjection({ catalog: albums, state: fixture.state, query: fixture.query });
      const started = performance.now();
      for (let index = 0; index < 250; index += 1) buildLibraryPresentationModel({ projection, catalog: albums });
      return [name, Number((performance.now() - started).toFixed(2))];
    }));
    console.info("R15_2B_PRESENTATION_PERFORMANCE_250", JSON.stringify(timings));
    expect(Math.max(...Object.values(timings))).toBeLessThan(5_000);
  });
});
