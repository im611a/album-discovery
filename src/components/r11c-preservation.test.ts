import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";
import { siteNavigationGroups } from "@/components/site-navigation";
import { createInitialUserState, parseLocalUserState } from "@/features/personal-state/schema";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("R11-C whole-site preservation contracts", () => {
  it("preserves the published catalog, album-detail, and artist route families", () => {
    expect(catalogAlbums.length).toBe(1_330);
    expect(publishedArtists.length).toBe(453);
    expect(source("src/app/albums/[slug]/page.tsx")).toContain("generateStaticParams");
    expect(source("src/app/artists/[slug]/page.tsx")).toContain("generateStaticParams");
    expect(source("src/components/albums/album-detail.tsx")).toContain("TrackList");
  });

  it("preserves the Discover URL contract and advanced filter families", () => {
    const discover = source("src/components/discover/discover-catalog.tsx");
    for (const key of ["coreGenre", "relatedGenre", "context", "decade", "releaseType", "sort"]) {
      expect(discover).toContain(key);
    }
    expect(discover).toContain("URLSearchParams");
  });

  it("preserves navigation destinations and versioned local-state recovery", () => {
    const hrefs = siteNavigationGroups.flatMap((group) => group.items.map(([href]) => href));
    expect(hrefs).toEqual(expect.arrayContaining(["/discover", "/for-you", "/library", "/new-releases", "/artists", "/search", "/settings"]));
    const initial = createInitialUserState();
    expect(initial.version).toBe(1);
    expect(parseLocalUserState(initial, new Set(catalogAlbums.map((album) => album.id)))).toMatchObject({ version: 1, onboardingCompleted: false });
    expect(parseLocalUserState({ version: 99 }, new Set())).toBeNull();
  });
});
