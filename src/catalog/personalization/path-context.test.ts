import { describe, expect, it } from "vitest";
import { catalogAlbums } from "../published-catalog";
import { buildPersonalJourneyAlbumHref, parsePersonalJourneyUrlContext } from "./path-context";

describe("R14 personal URL path context", () => {
  it("bounds, validates, and reconstructs only public album slugs", () => {
    const slugs = catalogAlbums.slice(0, 6).map((album) => album.slug);
    const parsed = parsePersonalJourneyUrlContext(`pfrom=album&ptrail=${[...slugs, "missing", slugs[5]].join("~")}`, catalogAlbums);
    expect(parsed.source).toBe("album");
    expect(parsed.trailAlbumSlugs).toEqual(slugs.slice(2, 6));
  });

  it("preserves only bounded R13 path fields when creating an album link", () => {
    const href = buildPersonalJourneyAlbumHref({ targetSlug: catalogAlbums[2].slug, source: "album", currentAlbumSlug: catalogAlbums[1].slug, searchParams: "entry=album&entryKey=x&trail=a&via=ERA_SAME&private=secret", catalog: catalogAlbums });
    expect(href).toContain("pfrom=album");
    expect(href).toContain(`ptrail=${catalogAlbums[1].slug}`);
    expect(href).not.toContain("private");
  });
});
