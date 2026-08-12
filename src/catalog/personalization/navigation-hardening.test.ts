import { describe, expect, it } from "vitest";
import { appendDiscoveryPathContext, parseDiscoveryPathContext, serializeDiscoveryPathContext } from "../discovery/path-context";
import { publishedDiscoveryIndex } from "../discovery/published-index";
import { catalogAlbums } from "../published-catalog";
import { buildPersonalJourneyAlbumHref, parsePersonalJourneyUrlContext } from "./path-context";

describe("R14-3I 10,000-transition route/context continuity", () => {
  it("keeps personal and relation contexts bounded, valid and independently reconstructible", () => {
    let personalQuery = "";
    let relation = parseDiscoveryPathContext("entry=explore", publishedDiscoveryIndex);
    let immediateLoops = 0;
    let previousTarget = "";
    for (let index = 0; index < 10_000; index += 1) {
      const current = catalogAlbums[index % catalogAlbums.length]!;
      const target = catalogAlbums[(index * 17 + 31) % catalogAlbums.length]!;
      if (target.slug === previousTarget) immediateLoops += 1;
      previousTarget = target.slug;
      const source = ["home", "for-you", "album", "artist", "explore"][index % 5] as "home" | "for-you" | "album" | "artist" | "explore";
      const href = buildPersonalJourneyAlbumHref({ targetSlug: target.slug, currentAlbumSlug: current.slug, source, searchParams: `${personalQuery}&private=secret&unknown=bad`, catalog: catalogAlbums });
      const query = href.split("?")[1] ?? "";
      const personal = parsePersonalJourneyUrlContext(query, catalogAlbums);
      expect(personal.trailAlbumSlugs.length).toBeLessThanOrEqual(4);
      expect(personal.trailAlbumSlugs.every((slug) => catalogAlbums.some((album) => album.slug === slug))).toBe(true);
      expect(query).not.toContain("private");
      expect(query).not.toContain("unknown");
      personalQuery = query;

      const family = index % 2 ? "PRIMARY_ADJACENT_ERA" : "SHARED_SECONDARY";
      relation = appendDiscoveryPathContext(relation, current.slug, family);
      const serialized = serializeDiscoveryPathContext(relation);
      expect(parseDiscoveryPathContext(serialized, publishedDiscoveryIndex)).toEqual(relation);
      expect(relation.trailAlbumSlugs.length).toBeLessThanOrEqual(3);
      expect(relation.transitionFamilies.length).toBeLessThanOrEqual(3);
      expect(parsePersonalJourneyUrlContext(serialized, catalogAlbums).source).toBeNull();
    }
    expect(immediateLoops).toBe(0);
  }, 60_000);

  it("sanitizes oversized, stale and provenance-impersonating query values", () => {
    const oversized = "x".repeat(513);
    expect(parsePersonalJourneyUrlContext(`pfrom=random&ptrail=${oversized}`, catalogAlbums)).toEqual({ source: null, trailAlbumSlugs: [] });
    const relation = parseDiscoveryPathContext(`entry=personal&entryKey=stale&trail=stale&via=PERSONAL~SERENDIPITY`, publishedDiscoveryIndex);
    expect(relation).toEqual({ trailAlbumSlugs: [], transitionFamilies: [] });
  });
});
