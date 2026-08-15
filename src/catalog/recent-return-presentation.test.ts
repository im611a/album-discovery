import { describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { catalogAlbums } from "./published-catalog";
import { buildRecentReturnPresentation, MAX_RECENT_RETURN_ITEMS } from "./recent-return-presentation";

const ids = catalogAlbums.map((album) => album.id);

describe("R17 recent-return presentation", () => {
  it("renders an intentional empty state without inventing history", () => {
    const result = buildRecentReturnPresentation({ state: null, catalog: catalogAlbums });
    expect(result).toMatchObject({ status: "EMPTY", totalCount: 0, items: [], libraryHref: "/library?view=recent" });
    expect(result.description).toContain("打开一张专辑");
  });

  it("reuses canonical recent ordering, reconciliation, dedupe and bounds", () => {
    const state = { ...createInitialUserState(), recentAlbumIds: [ids[4], "missing", ids[2], ids[4], ...ids.slice(5, 30)] };
    const result = buildRecentReturnPresentation({ state, catalog: catalogAlbums, limit: 99 });
    expect(result.status).toBe("READY");
    expect(result.items).toHaveLength(MAX_RECENT_RETURN_ITEMS);
    expect(result.items.map((item) => item.album.id)).toEqual([ids[4], ids[2], ...ids.slice(5, 9)]);
    expect(result.totalCount).toBe(20);
    expect(result.items.every((item) => item.href.includes("lfrom=library") && item.href.includes("lview=recent"))).toBe(true);
  });

  it("is deterministic and contains no listening or preference claim", () => {
    const state = { ...createInitialUserState(), recentAlbumIds: ids.slice(0, 12) };
    const first = buildRecentReturnPresentation({ state, catalog: catalogAlbums });
    expect(JSON.stringify(first)).toBe(JSON.stringify(buildRecentReturnPresentation({ state, catalog: catalogAlbums })));
    expect(JSON.stringify(first)).not.toMatch(/最近听过|播放过|常听|最喜欢|根据你的收听|你的口味/);
  });

  it("replays 25,000 mixed projections without invalid or nondeterministic targets", () => {
    let failures = 0;
    for (let index = 0; index < 25_000; index += 1) {
      const recentAlbumIds = Array.from({ length: 28 }, (_, offset) =>
        offset % 8 === 0 ? `stale:${offset}` : ids[(index * 17 + offset * 13) % ids.length]);
      const state = { recentAlbumIds: [...recentAlbumIds, ...recentAlbumIds.slice(0, 4)] };
      const first = buildRecentReturnPresentation({ state, catalog: catalogAlbums, limit: index % 7 });
      const replay = buildRecentReturnPresentation({ state, catalog: catalogAlbums, limit: index % 7 });
      const projected = first.items.map((item) => item.album.id);
      if (JSON.stringify(first) !== JSON.stringify(replay)
        || projected.some((id) => !ids.includes(id))
        || new Set(projected).size !== projected.length
        || projected.length > MAX_RECENT_RETURN_ITEMS) failures += 1;
    }
    expect(failures).toBe(0);
  }, 120_000);
});
