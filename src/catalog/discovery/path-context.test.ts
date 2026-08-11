import { describe, expect, it } from "vitest";
import { publishedDiscoveryIndex } from "./published-index";
import {
  appendDiscoveryEntityPathContext,
  appendDiscoveryPathContext,
  parseDiscoveryPathContext,
  serializeDiscoveryPathContext,
} from "./path-context";

describe("R13 discovery path context", () => {
  it("parses only allowlisted canonical entry and path values", () => {
    const context = parseDiscoveryPathContext(
      "entry=album&entryKey=rumours&trail=ok-computer~missing~loveless&via=PRIMARY_ONLY~BAD~SHARED_SECONDARY",
      publishedDiscoveryIndex,
    );
    expect(context).toEqual({
      entryKind: "album",
      entryKey: "rumours",
      trailAlbumSlugs: ["ok-computer", "loveless"],
      transitionFamilies: ["PRIMARY_ONLY", "SHARED_SECONDARY"],
    });
  });

  it("bounds the trail, removes older duplicates, and preserves the newest occurrence", () => {
    const context = parseDiscoveryPathContext(
      "trail=rumours~loveless~ok-computer~rumours&via=PRIMARY_ONLY~PRIMARY_ONLY~PRIMARY_ONLY~SHARED_SECONDARY",
      publishedDiscoveryIndex,
    );
    expect(context.trailAlbumSlugs).toEqual(["loveless", "ok-computer", "rumours"]);
    expect(context.transitionFamilies).toEqual(["PRIMARY_ONLY", "PRIMARY_ONLY", "SHARED_SECONDARY"]);
  });

  it("ignores malformed entry context without invalidating a valid album trail", () => {
    const context = parseDiscoveryPathContext(
      "entry=artist&entryKey=not-an-artist&trail=rumours&via=SHARED_SECONDARY",
      publishedDiscoveryIndex,
    );
    expect(context.entryKind).toBeUndefined();
    expect(context.entryKey).toBeUndefined();
    expect(context.trailAlbumSlugs).toEqual(["rumours"]);
  });

  it("round-trips deterministically and appends a bounded transition", () => {
    const initial = parseDiscoveryPathContext(
      "entry=primary-genre&entryKey=rock&trail=rumours~loveless&via=SHARED_SECONDARY~PRIMARY_ONLY",
      publishedDiscoveryIndex,
    );
    const next = appendDiscoveryPathContext(initial, "ok-computer", "PRIMARY_ADJACENT_ERA");
    const serialized = serializeDiscoveryPathContext(next);
    expect(parseDiscoveryPathContext(serialized, publishedDiscoveryIndex)).toEqual(next);
    expect(next.trailAlbumSlugs).toEqual(["rumours", "loveless", "ok-computer"]);
    expect(next.transitionFamilies).toEqual([
      "SHARED_SECONDARY",
      "PRIMARY_ONLY",
      "PRIMARY_ADJACENT_ERA",
    ]);
  });

  it("rejects oversized raw values", () => {
    const context = parseDiscoveryPathContext(`trail=${"x".repeat(513)}&via=${"x".repeat(513)}`, publishedDiscoveryIndex);
    expect(context.trailAlbumSlugs).toEqual([]);
    expect(context.transitionFamilies).toEqual([]);
  });

  it("carries a bounded Album origin through an Artist or topic entity hop", () => {
    const incoming = parseDiscoveryPathContext(
      "entry=primary-genre&entryKey=rock&trail=rumours~loveless~ok-computer&via=SHARED_SECONDARY~PRIMARY_ONLY~PRIMARY_ADJACENT_ERA",
      publishedDiscoveryIndex,
    );
    const next = appendDiscoveryEntityPathContext(incoming, "blue-joni-mitchell");
    expect(next).toEqual({
      entryKind: "primary-genre",
      entryKey: "rock",
      trailAlbumSlugs: ["loveless", "ok-computer", "blue-joni-mitchell"],
      transitionFamilies: ["SHARED_SECONDARY", "PRIMARY_ONLY", "PRIMARY_ADJACENT_ERA"],
    });
    expect(parseDiscoveryPathContext(
      serializeDiscoveryPathContext(next),
      publishedDiscoveryIndex,
    )).toEqual(next);
  });

  it("seeds a direct Album origin without fabricating a relation family", () => {
    expect(appendDiscoveryEntityPathContext({
      trailAlbumSlugs: [],
      transitionFamilies: [],
    }, "rumours")).toEqual({
      entryKind: "album",
      entryKey: "rumours",
      trailAlbumSlugs: ["rumours"],
      transitionFamilies: [],
    });
  });
});
