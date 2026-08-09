import { describe, expect, it } from "vitest";
import { clampHomepageProgress, getHomepageGalleryGeometry, getMarkerState, REFERENCE_POSTER_ASPECT_RATIO, SQUARE_MEDIA_SCALE } from "./homepage-geometry";

describe("homepage geometry", () => {
  it("maps all 24 indexes deterministically at desktop and mobile widths", () => {
    const desktop = Array.from({ length: 24 }, (_, index) => getHomepageGalleryGeometry(index, 1440));
    const mobile = Array.from({ length: 24 }, (_, index) => getHomepageGalleryGeometry(index, 390));
    expect(desktop).toHaveLength(24);
    expect(mobile).toHaveLength(24);
    expect(desktop).toEqual(Array.from({ length: 24 }, (_, index) => getHomepageGalleryGeometry(index, 1440)));
    expect(desktop.some((item) => item.size === "large")).toBe(true);
    expect(mobile.every((item) => item.gridColumn.includes("span"))).toBe(true);
  });

  it("conserves the reference poster area when gallery media becomes square", () => {
    const expected = Math.sqrt(REFERENCE_POSTER_ASPECT_RATIO);
    expect(SQUARE_MEDIA_SCALE).toBeCloseTo(expected, 6);
    expect(getHomepageGalleryGeometry(0, 1440).squareMediaScale).toBeCloseTo(expected, 6);
    expect(getHomepageGalleryGeometry(0, 390).squareMediaScale).toBeCloseTo(expected, 6);
  });

  it("rejects out-of-range indexes and clamps page progress", () => {
    expect(() => getHomepageGalleryGeometry(-1, 1440)).toThrow(RangeError);
    expect(() => getHomepageGalleryGeometry(24, 1440)).toThrow(RangeError);
    expect(clampHomepageProgress(-1)).toBe(0);
    expect(clampHomepageProgress(0.5)).toBe(0.5);
    expect(clampHomepageProgress(2)).toBe(1);
  });

  it("keeps the marker unrotated from initial through final state", () => {
    const initial = getMarkerState(900, 900, 1440);
    const middle = getMarkerState(360, 900, 1440);
    const final = getMarkerState(0, 900, 1440);
    expect(initial.progress).toBe(0);
    expect(middle.progress).toBeGreaterThan(0);
    expect(final.progress).toBe(1);
    expect([initial, middle, final].every((item) => !item.transform.includes("rotate"))).toBe(true);
  });
});
