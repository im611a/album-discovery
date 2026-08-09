import { describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { buildAlbumDetailViewModel, getAlbumDetailStaticParams, getAlbumDetailViewModel } from "./album-detail-view-model";
import { getAlbumDetailBySlug } from "./published-album-details";
import { catalogAlbums } from "./published-catalog";
import { getRelatedAlbums } from "./queries";

describe("album detail foundation", () => {
  it("adapts all 345 static details with unique IDs and slugs", () => {
    const params = getAlbumDetailStaticParams();
    const details = params.map(({ slug }) => getAlbumDetailViewModel(slug));
    expect(params).toHaveLength(345);
    expect(details.every(Boolean)).toBe(true);
    expect(new Set(details.map((item) => item?.album.id)).size).toBe(345);
    expect(new Set(params.map((item) => item.slug)).size).toBe(345);
  });

  it("hides null RYM ratings and never turns UNVERIFIED_NO_DATA into zero", () => {
    const detail = catalogAlbums.map((item) => getAlbumDetailBySlug(item.slug))
      .find((item) => item?.rymRating == null);
    expect(detail).toBeDefined();
    const view = buildAlbumDetailViewModel(detail!);
    expect(view.rating).toMatchObject({ visible: false, value: null });
    expect(view.rating.value).not.toBe(0);
  });

  it("preserves the 26 newly added UNVERIFIED_NO_DATA records as unavailable", () => {
    const unverified = catalogAlbums
      .map((item) => getAlbumDetailBySlug(item.slug))
      .filter((item) => item?.rymMatchStatus === "UNVERIFIED_NO_DATA");
    expect(unverified).toHaveLength(26);
    expect(unverified.every((item) => {
      const rating = buildAlbumDetailViewModel(item!).rating;
      return !rating.visible && rating.value === null;
    })).toBe(true);
  });

  it("shows a verified rating without changing its value", () => {
    const detail = catalogAlbums.map((item) => getAlbumDetailBySlug(item.slug))
      .find((item) => item?.rymRating != null);
    expect(detail).toBeDefined();
    const view = buildAlbumDetailViewModel(detail!);
    expect(view.rating.visible).toBe(true);
    expect(view.rating.value).toBe(detail?.rymRating);
  });

  it("keeps primary, secondary and scene fields separate", () => {
    const detail = getAlbumDetailBySlug(catalogAlbums.find((item) => item.relatedGenres.length)?.slug ?? catalogAlbums[0].slug);
    expect(detail).toBeDefined();
    const view = buildAlbumDetailViewModel(detail!);
    expect(view.taxonomy.primaryGenres).toEqual(detail?.coreGenres);
    expect(view.taxonomy.secondaryGenres).toEqual(detail?.relatedGenres);
    expect(view.taxonomy.scenes).toEqual(detail?.contexts);
    expect(view.taxonomy.scenes).not.toBe(detail?.descriptors);
  });

  it("exposes only the existing canonical NetEase link", () => {
    const detail = getAlbumDetailBySlug(catalogAlbums[0].slug);
    const view = buildAlbumDetailViewModel(detail!);
    expect(view.externalLinks).toEqual([{
      platform: "netease",
      label: "网易云音乐",
      href: detail?.externalUrl,
    }]);
  });

  it("reuses the current recommendation result and personal-state schema", () => {
    const summary = catalogAlbums.find((item) => getRelatedAlbums(item).length) ?? catalogAlbums[0];
    const detail = getAlbumDetailBySlug(summary.slug)!;
    const state = {
      ...createInitialUserState(),
      likedAlbumIds: [detail.id],
      savedAlbumIds: [detail.id],
    };
    const view = buildAlbumDetailViewModel(detail, state);
    expect(view.recommendations).toEqual(getRelatedAlbums(summary));
    expect(view.userStatus).toMatchObject({ liked: true, saved: true, dismissed: false });
  });

  it("preserves Chinese, Japanese and special line-separator titles as data", () => {
    const multilingual = catalogAlbums.filter((album) => /[\u3040-\u30ff\u3400-\u9fff]/u.test(album.title));
    expect(multilingual.length).toBeGreaterThan(0);
    const source = getAlbumDetailBySlug(catalogAlbums[0].slug)!;
    const synthetic = { ...source, title: `A\u2028B\u2029C` };
    expect(buildAlbumDetailViewModel(synthetic).album.title).toBe(`A\u2028B\u2029C`);
  });
});
