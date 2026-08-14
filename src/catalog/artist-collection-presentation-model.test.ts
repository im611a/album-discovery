import { describe, expect, it } from "vitest";

import { buildArtistCollectionFixtures, ARTIST_COLLECTION_FIXTURE_NAMES } from "./artist-collection-fixtures";
import { projectArtistCollection } from "./artist-collection";
import { buildArtistCollectionAlbumHref } from "./artist-collection-navigation";
import { ARTIST_COLLECTION_RESPONSIVE_CONTRACT, buildArtistCollectionPresentationModel } from "./artist-collection-presentation-model";
import { catalogAlbums, publishedArtists } from "./published-catalog";

const fixtures = () => buildArtistCollectionFixtures(publishedArtists, catalogAlbums);
const strings = (value: unknown): string[] => typeof value === "string"
  ? [value]
  : Array.isArray(value)
    ? value.flatMap(strings)
    : value && typeof value === "object"
      ? Object.values(value).flatMap(strings)
      : [];

describe("R16 Artist collection presentation architecture", () => {
  it("builds all required empty/sparse/dense/mixed, long-title and multi-credit fixtures", () => {
    const result = fixtures();
    expect(result.map((fixture) => fixture.name)).toEqual(ARTIST_COLLECTION_FIXTURE_NAMES);
    expect(result).toHaveLength(12);
    expect(result.find((fixture) => fixture.name === "multi-work-no-state")?.presentation.collection.shape).toBe("EMPTY");
    expect(result.find((fixture) => fixture.name === "multi-work-one-kept")?.presentation.collection.shape).toBe("SPARSE");
    expect(result.find((fixture) => fixture.name === "multi-work-many-kept")?.presentation.collection.shape).toBe("DENSE");
    expect(result.find((fixture) => fixture.name === "multi-work-mixed")?.presentation.collection.shape).toBe("MIXED");
    expect(result.find((fixture) => fixture.name === "multi-work-long-title")?.presentation.chronology.some((work) => work.title.length > 40)).toBe(true);
    expect(result.find((fixture) => fixture.name === "multi-work-multi-credit")?.presentation.chronology.some((work) => work.creditLabel.includes("共同署名"))).toBe(true);
  });

  it("keeps Artist identity/chronology dominant and local collection context secondary", () => {
    const model = fixtures().find((fixture) => fixture.name === "multi-work-mixed")!.presentation;
    expect(model.hierarchy).toEqual({ primary: "ARTIST_ARCHIVE_CHRONOLOGY", secondary: "CURRENT_DEVICE_COLLECTION_CONTEXT" });
    expect(model.chronology.length).toBe(model.artist.catalogShape === "MULTI_WORK" ? model.chronology.length : 1);
    expect(model.collection.heading).toBe("这位艺人与我的专辑");
    expect(model.collection.metrics.every((metric) => metric.count > 0)).toBe(true);
    expect(model.collection.contextualWorks.every((work) => work.primaryStatus !== "NONE")).toBe(true);
  });

  it("uses inline metadata for single-work Artists and never duplicates the only Album card", () => {
    for (const name of ["single-work-no-state", "single-work-kept", "single-work-recent"] as const) {
      const model = fixtures().find((fixture) => fixture.name === name)!.presentation;
      expect(model.collection).toMatchObject({ mode: "INLINE_SINGLE_WORK", duplicateChronologyCards: false });
      expect(model.chronology).toHaveLength(1);
      expect(model.collection.keptWorks).toHaveLength(0);
      expect(model.collection.remainingWorks).toHaveLength(0);
      expect(model.collection.recentlyViewedWorks).toHaveLength(0);
    }
  });

  it("uses truthful count copy without artist preference, follow, popularity or playback claims", () => {
    const copy = strings(fixtures().map((fixture) => fixture.presentation)).join(" ");
    expect(copy).toContain("你的本机专辑中有");
    expect(copy).toContain("最近查看");
    expect(copy).not.toMatch(/你很喜欢这位|经常听|最常听|热门艺术家|关注了|听歌习惯|为你推荐这位|探索了.*%|播放历史|收听历史/);
  });

  it("preserves return origin independently from discovery and personal provenance", () => {
    const target = catalogAlbums[0]!;
    const library = buildArtistCollectionAlbumHref({ targetSlug: target.slug, searchParams: "lfrom=library&lview=favorite&entry=explore&pfrom=for-you", catalog: catalogAlbums })!;
    expect(library).toContain("lfrom=library");
    expect(library).toContain("entry=explore");
    expect(library).toContain("pfrom=for-you");
    const search = buildArtistCollectionAlbumHref({ targetSlug: target.slug, searchParams: "sfrom=search&sq=%E7%8E%8B%E8%8F%B2&entry=album&entryKey=" + target.slug, catalog: catalogAlbums })!;
    expect(search).toContain("sfrom=search");
    expect(search).toContain("entry=album");
    expect(search).not.toContain("lfrom=library");
    const direct = buildArtistCollectionAlbumHref({ targetSlug: target.slug, catalog: catalogAlbums });
    expect(direct).toBe(`/albums/${target.slug}`);
  });

  it.each([
    ["Library → Album → Artist", "lfrom=library&lview=favorite", "LIBRARY", null, false, [], null],
    ["Library → relation Album → Artist", "lfrom=library&entry=album&trail=wake-after-the-rain&via=SHARED_ARTIST", "LIBRARY", null, true, ["SHARED_ARTIST"], null],
    ["Search → Artist", "sfrom=search&sq=%E7%8E%8B%E8%8F%B2", "SEARCH", null, false, [], null],
    ["Direct Artist", "", "NONE", null, false, [], null],
    ["For You → Album → Artist", "pfrom=for-you&ptrail=wake-after-the-rain", "NONE", null, false, [], "for-you"],
    ["Explore relation → Album → Artist", "entry=explore&trail=wake-after-the-rain&via=SHARED_ARTIST", "NONE", "explore", true, ["SHARED_ARTIST"], null],
    ["Serendipity → Album → Artist", "entry=explore", "NONE", "explore", true, [], null],
  ] as const)("keeps authority separation for %s", (_journey, query, returnOrigin, discoveryEntry, discoveryActive, relationFamilies, personalSource) => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const projection = projectArtistCollection({ artist, catalog: catalogAlbums, state: null });
    const model = buildArtistCollectionPresentationModel({ projection, catalog: catalogAlbums, searchParams: query });
    expect(model.navigation).toEqual({ returnOrigin, discoveryEntry, discoveryActive, relationFamilies, personalSource });
  });

  it("keeps invalid mixed return origins neutral while retaining independently valid provenance", () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const projection = projectArtistCollection({ artist, catalog: catalogAlbums, state: null });
    const model = buildArtistCollectionPresentationModel({ projection, catalog: catalogAlbums, searchParams: "lfrom=library&sfrom=search&entry=explore" });
    expect(model.navigation).toEqual({ returnOrigin: "NONE", discoveryEntry: "explore", discoveryActive: true, relationFamilies: [], personalSource: null });
    expect(model.chronology.every((work) => !work.href.includes("lfrom=") && !work.href.includes("sfrom="))).toBe(true);
  });

  it("defines semantic, keyboard, non-color, 200% zoom and all required viewport contracts before UI activation", () => {
    const model = fixtures()[0]!.presentation;
    expect(model.accessibility).toMatchObject({ semanticHeadingRequired: true, realLinksRequired: true, focusVisibleRequired: true, nonColorStateLabelsRequired: true });
    expect(ARTIST_COLLECTION_RESPONSIVE_CONTRACT.viewports).toEqual([390, 768, 1024, 1280, 1440, 2048]);
    expect(ARTIST_COLLECTION_RESPONSIVE_CONTRACT.zoom).toBe(2);
    expect(ARTIST_COLLECTION_RESPONSIVE_CONTRACT.contentOrder).toEqual(["ARTIST_IDENTITY", "CHRONOLOGY", "COLLECTION_CONTEXT", "CONTINUATION"]);
  });
});
