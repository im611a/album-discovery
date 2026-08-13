import { describe, expect, it } from "vitest";

import { createInitialUserState } from "@/features/personal-state/schema";

import {
  buildLibraryAlbumHref,
  buildLibraryProjection,
  MAX_LIBRARY_QUERY_LENGTH,
  normalizeLibraryState,
  parseLibraryQuery,
  parseLibraryReturnContext,
  serializeLibraryQuery,
  type LibraryProjection,
} from "./collection-presentation";
import { catalogAlbums } from "./published-catalog";

const albums = catalogAlbums;
const ids = albums.map((album) => album.id);

function stateWith(values: Partial<ReturnType<typeof createInitialUserState>>) {
  return { ...createInitialUserState(), ...values };
}

function signature(projection: LibraryProjection) {
  return JSON.stringify({
    query: projection.query,
    entries: projection.entries.map((entry) => ({
      id: entry.albumId,
      reasons: entry.membershipReasons,
      states: entry.states,
      recent: entry.recentPosition,
      changed: entry.lastChangedAt,
    })),
    recent: projection.recentEntries.map((entry) => entry.albumId),
    facets: projection.facets,
    summary: projection.summary,
    emptyReason: projection.emptyReason,
  });
}

describe("R15 Library domain foundation", () => {
  it("projects an empty state without synthesizing membership or playback", () => {
    const result = buildLibraryProjection({ catalog: albums, state: null });
    expect(result.entries).toEqual([]);
    expect(result.recentEntries).toEqual([]);
    expect(result.summary).toEqual({
      totalLibraryAlbums: 0,
      savedCount: 0,
      likedCount: 0,
      favoriteCount: 0,
      markedListenedCount: 0,
      dismissedCount: 0,
      recentlyViewedCount: 0,
    });
    expect(result.emptyReason).toBe("FRESH");
  });

  it.each([
    ["savedAlbumIds", "saved", "SAVED", "savedCount"],
    ["favoriteAlbumIds", "favorite", "FAVORITE", "favoriteCount"],
    ["listenedAlbumIds", "listened", "MARKED_LISTENED", "markedListenedCount"],
  ] as const)("projects one truthful %s membership", (field, view, reason, countKey) => {
    const result = buildLibraryProjection({ catalog: albums, state: stateWith({ [field]: [ids[0]] }), query: `view=${view}` });
    expect(result.entries.map((entry) => entry.albumId)).toEqual([ids[0]]);
    expect(result.entries[0].membershipReasons).toContain(reason);
    expect(result.summary[countKey]).toBe(1);
    expect(result.entries[0].lastChangedAt).toBeNull();
  });

  it("keeps explicit states distinct while deduplicating ALL membership", () => {
    const result = buildLibraryProjection({
      catalog: albums,
      state: stateWith({
        savedAlbumIds: [ids[0]], likedAlbumIds: [ids[0]],
        favoriteAlbumIds: [ids[0]], listenedAlbumIds: [ids[0]],
      }),
      query: "view=all",
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].membershipReasons).toEqual(["SAVED", "LIKED", "FAVORITE", "MARKED_LISTENED"]);
    expect(result.summary).toMatchObject({ totalLibraryAlbums: 1, savedCount: 1, likedCount: 1, favoriteCount: 1, markedListenedCount: 1 });
  });

  it("reconciles duplicates, empty IDs, stale IDs, duplicate catalog IDs, and malformed arrays", () => {
    const duplicateCatalog = [albums[0], albums[0], ...albums.slice(1)];
    const result = buildLibraryProjection({
      catalog: duplicateCatalog,
      state: {
        savedAlbumIds: [ids[0], ids[0], "", "missing"],
        favoriteAlbumIds: "malformed",
        listenedAlbumIds: [ids[1], 42],
        recentAlbumIds: ["missing", ids[0], ids[0]],
      },
      query: "view=all",
    });
    expect(result.entries.map((entry) => entry.albumId)).toEqual([ids[0], ids[1]]);
    expect(new Set(result.entries.map((entry) => entry.albumId)).size).toBe(result.entries.length);
    expect(result.recentEntries.map((entry) => entry.albumId)).toEqual([ids[0]]);
  });

  it("preserves approved negative precedence without erasing marked-listened fact", () => {
    const result = buildLibraryProjection({
      catalog: albums,
      state: stateWith({
        savedAlbumIds: [ids[0]], likedAlbumIds: [ids[0]], favoriteAlbumIds: [ids[0]],
        listenedAlbumIds: [ids[0]], dismissedAlbumIds: [ids[0]],
        recommendationFeedback: { [ids[0]]: "not_for_me" },
      }),
      query: "view=all",
    });
    expect(result.entries[0].membershipReasons).toEqual(["MARKED_LISTENED"]);
    expect(result.entries[0].states.dismissed).toBe(true);
    expect(result.summary).toMatchObject({ savedCount: 0, likedCount: 0, favoriteCount: 0, markedListenedCount: 1, dismissedCount: 1 });
  });

  it("treats recent page views as a separate bounded browsing history", () => {
    const history = [...ids.slice(0, 25), ids[0], "missing"];
    const result = buildLibraryProjection({ catalog: albums, state: stateWith({ recentAlbumIds: history }), query: "view=recent" });
    expect(result.summary.totalLibraryAlbums).toBe(0);
    expect(result.recentEntries).toHaveLength(20);
    expect(result.recentEntries.map((entry) => entry.albumId)).toEqual(ids.slice(0, 20));
    expect(result.facets.find((item) => item.facet === "recent")?.semanticNote).toContain("浏览不等于收听");
  });

  it("uses published catalog order by default and stable explicit tie breakers", () => {
    const selected = [albums[4], albums[1], albums[3]];
    const state = stateWith({ savedAlbumIds: selected.map((album) => album.id) });
    expect(buildLibraryProjection({ catalog: albums, state, query: "view=saved" }).entries.map((entry) => entry.albumId)).toEqual([albums[1].id, albums[3].id, albums[4].id]);
    const title = buildLibraryProjection({ catalog: albums, state, query: "view=saved&sort=title" }).entries;
    expect(title.map((entry) => entry.albumId)).toEqual([...title].sort((a, b) => a.album.title.localeCompare(b.album.title, "zh-CN") || a.albumId.localeCompare(b.albumId)).map((entry) => entry.albumId));
    const release = buildLibraryProjection({ catalog: albums, state, query: "view=saved&sort=release-newest" }).entries;
    expect(release.map((entry) => entry.albumId)).toEqual([...release].sort((a, b) => (b.album.releaseDate ?? "0000").localeCompare(a.album.releaseDate ?? "0000") || a.album.title.localeCompare(b.album.title, "zh-CN") || a.albumId.localeCompare(b.albumId)).map((entry) => entry.albumId));
  });

  it("preserves newest valid recent position while explicit sorts remain deterministic", () => {
    const state = stateWith({ recentAlbumIds: [ids[5], ids[2], ids[5], ids[1]] });
    const recent = buildLibraryProjection({ catalog: albums, state, query: "view=recent" });
    expect(recent.entries.map((entry) => entry.albumId)).toEqual([ids[5], ids[2], ids[1]]);
    const replay = buildLibraryProjection({ catalog: albums, state, query: "view=recent&sort=title" });
    expect(signature(replay)).toBe(signature(buildLibraryProjection({ catalog: albums, state, query: "view=recent&sort=title" })));
  });

  it("normalizes tolerant partial, legacy, unknown-field, and corrupt inputs deterministically", () => {
    const legacy = { favoriteAlbumIds: [ids[0]], unknownFutureField: { anything: true }, recentAlbumIds: null };
    const first = normalizeLibraryState(legacy, albums);
    expect(first.favoriteAlbumIds).toEqual([ids[0]]);
    expect(first.likedAlbumIds).toEqual([ids[0]]);
    expect(first).toEqual(normalizeLibraryState(legacy, albums));
    expect(normalizeLibraryState("{bad json", albums)).toEqual(normalizeLibraryState(null, albums));
    expect(normalizeLibraryState({ version: 1, savedAlbumIds: [ids[1]], future: "ignored" }, albums).savedAlbumIds).toEqual([ids[1]]);
  });

  it("parses, bounds, serializes, and replays Library query state", () => {
    const raw = `view=favorite&q=${"专".repeat(120)}&sort=title&private=${ids[0]}`;
    const parsed = parseLibraryQuery(raw);
    expect(parsed).toEqual({ view: "favorite", query: "专".repeat(MAX_LIBRARY_QUERY_LENGTH), sort: "title" });
    expect(serializeLibraryQuery(parsed)).not.toContain("private");
    expect(parseLibraryQuery(serializeLibraryQuery(parsed))).toEqual(parsed);
    expect(parseLibraryQuery("view=bad&sort=random")).toEqual({ view: "overview", query: "", sort: "catalog" });
  });

  it("distinguishes fresh, empty facet, and no-query-match facts", () => {
    const state = stateWith({ savedAlbumIds: [ids[0]] });
    expect(buildLibraryProjection({ catalog: albums, state, query: "view=favorite" }).emptyReason).toBe("VIEW_EMPTY");
    expect(buildLibraryProjection({ catalog: albums, state, query: "view=saved&q=not-a-real-title" }).emptyReason).toBe("NO_QUERY_MATCH");
    expect(buildLibraryProjection({ catalog: albums, state: stateWith({ dismissedAlbumIds: [ids[1]] }), query: "view=all" }).emptyReason).toBe("VIEW_EMPTY");
  });

  it("ignores unsupported slug references and invalid timestamps instead of inventing album identities or ordering", () => {
    const result = buildLibraryProjection({
      catalog: albums,
      state: {
        version: 1,
        savedAlbumIds: [albums[0].slug],
        recentAlbumIds: [albums[1].slug],
        updatedAt: "not-a-date",
        savedAt: { [ids[0]]: "also-not-a-date" },
      },
    });
    expect(result.summary.totalLibraryAlbums).toBe(0);
    expect(result.summary.recentlyViewedCount).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it("prepares bounded Library origin context without changing R14 pfrom semantics", () => {
    const href = buildLibraryAlbumHref({ targetSlug: albums[0].slug, view: "saved", catalog: albums });
    expect(href).toBe(`/albums/${albums[0].slug}?lfrom=library&lview=saved`);
    expect(parseLibraryReturnContext(href!.split("?")[1])).toEqual({ source: "library", view: "saved", query: "", sort: "catalog" });
    expect(parseLibraryReturnContext("lfrom=library&lview=invalid")).toEqual({ source: "library", view: null, query: "", sort: "catalog" });
    expect(parseLibraryReturnContext(`lfrom=${"library".repeat(20)}&lview=saved`)).toEqual({ source: null, view: null, query: "", sort: null });
    expect(buildLibraryAlbumHref({ targetSlug: "missing", view: "all", catalog: albums })).toBeNull();
    expect(href).not.toContain("pfrom");
  });

  it("does not mutate user state, published catalog, or catalog albums", () => {
    const state = stateWith({ savedAlbumIds: [ids[0], ids[1]], recentAlbumIds: [ids[2], ids[1]] });
    const stateBefore = JSON.stringify(state);
    const catalogBefore = JSON.stringify(albums);
    buildLibraryProjection({ catalog: albums, state, query: "view=all&sort=title" });
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(albums)).toBe(catalogBefore);
  });
});

describe("R15 Library real-catalog deterministic simulation", () => {
  it("projects 20,000 mixed states with zero domain contract failures", () => {
    let seed = 1502;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const sample = (length: number, stale = false) => Array.from({ length }, (_, index) =>
      stale && index % 9 === 0 ? `stale:${index}` : ids[Math.floor(random() * ids.length)],
    );
    const failures = {
      projectionExceptions: 0, invalidRenderedAlbums: 0, duplicateProjectedAlbums: 0,
      nondeterministicOutputs: 0, falseStateClaims: 0, catalogMutation: 0,
      inputStateMutation: 0, unboundedOutput: 0,
    };
    let entryEvaluations = 0;
    const catalogIds = new Set(ids);
    const catalogBefore = JSON.stringify(albums);
    for (let index = 0; index < 20_000; index += 1) {
      const overlap = sample(index % 7, true);
      const dismissed = sample(index % 11, true);
      const state: unknown = index % 10 === 4
        ? { savedAlbumIds: "bad", recentAlbumIds: [null, ...sample(40, true)], extra: true }
        : {
          version: 1,
          savedAlbumIds: [...overlap, ...sample(index % 29, true), ...overlap],
          likedAlbumIds: [...overlap, ...sample(index % 23, true)],
          favoriteAlbumIds: [...overlap, ...sample(index % 19, true)],
          listenedAlbumIds: [...sample(index % 17, true), ...dismissed.slice(0, 2)],
          dismissedAlbumIds: dismissed,
          recentAlbumIds: [...sample(35, true), ...overlap],
          recommendationFeedback: Object.fromEntries(dismissed.map((id) => [id, "not_for_me"])),
          unknown: { index },
        };
      const inputBefore = JSON.stringify(state);
      try {
        const query = `view=${["all", "saved", "liked", "favorite", "listened", "dismissed", "recent"][index % 7]}&sort=${["catalog", "title", "release-newest"][index % 3]}`;
        const first = buildLibraryProjection({ catalog: albums, state, query });
        const replay = buildLibraryProjection({ catalog: albums, state, query });
        entryEvaluations += first.entries.length + first.recentEntries.length;
        failures.invalidRenderedAlbums += first.entries.filter((entry) => !catalogIds.has(entry.albumId)).length;
        if (new Set(first.entries.map((entry) => entry.albumId)).size !== first.entries.length) failures.duplicateProjectedAlbums += 1;
        if (signature(first) !== signature(replay)) failures.nondeterministicOutputs += 1;
        failures.falseStateClaims += first.entries.filter((entry) =>
          entry.membershipReasons.includes("SAVED") !== entry.states.saved ||
          entry.membershipReasons.includes("LIKED") !== entry.states.liked ||
          entry.membershipReasons.includes("FAVORITE") !== entry.states.favorite ||
          entry.membershipReasons.includes("MARKED_LISTENED") !== entry.states.markedListened
        ).length;
        if (first.entries.length > albums.length || first.recentEntries.length > 20) failures.unboundedOutput += 1;
        if (JSON.stringify(state) !== inputBefore) failures.inputStateMutation += 1;
      } catch {
        failures.projectionExceptions += 1;
      }
    }
    failures.catalogMutation = JSON.stringify(albums) === catalogBefore ? 0 : 1;
    console.info("R15_2A_SIMULATION", JSON.stringify({ states: 20_000, entryEvaluations, ...failures }));
    expect(entryEvaluations).toBeGreaterThan(100_000);
    expect(failures).toEqual({
      projectionExceptions: 0, invalidRenderedAlbums: 0, duplicateProjectedAlbums: 0,
      nondeterministicOutputs: 0, falseStateClaims: 0, catalogMutation: 0,
      inputStateMutation: 0, unboundedOutput: 0,
    });
  }, 120_000);

  it("measures linear projection cost for empty, small, dense, and worst bounded states", () => {
    const fixtures = {
      empty: null,
      small: stateWith({ savedAlbumIds: ids.slice(0, 8), recentAlbumIds: ids.slice(0, 8) }),
      dense: stateWith({ savedAlbumIds: ids, favoriteAlbumIds: ids.slice().reverse(), listenedAlbumIds: ids }),
      worstBounded: stateWith({
        savedAlbumIds: [...ids, ...ids], likedAlbumIds: [...ids, ...ids],
        favoriteAlbumIds: [...ids, ...ids], listenedAlbumIds: [...ids, ...ids],
        dismissedAlbumIds: ids.filter((_, index) => index % 7 === 0),
        recentAlbumIds: [...ids, ...ids],
      }),
    };
    const timings = Object.fromEntries(Object.entries(fixtures).map(([name, state]) => {
      const started = performance.now();
      for (let index = 0; index < 250; index += 1) {
        buildLibraryProjection({ catalog: albums, state, query: `view=all&sort=${index % 2 ? "title" : "catalog"}` });
      }
      return [name, Number((performance.now() - started).toFixed(2))];
    }));
    console.info("R15_2A_PERFORMANCE_250_PROJECTIONS_MS", JSON.stringify(timings));
    expect(Math.max(...Object.values(timings))).toBeLessThan(5_000);
  });
});
