import { describe, expect, it } from "vitest";

import { albumDetailsMock } from "@/data/album-details.mock";
import { albumsMock } from "@/data/albums.mock";
import {
  formatDuration,
  formatRatingCount,
  getAlbumDetailById,
  getAlbumDetailBySlug,
  groupTracksByDisc,
  shouldShowTrackArtists,
} from "@/lib/album-details";

describe("album detail data", () => {
  it("provides detail data for every mock album slug", () => {
    expect(albumDetailsMock).toHaveLength(albumsMock.length);

    for (const album of albumsMock) {
      const result = getAlbumDetailBySlug(album.slug);
      expect(result?.album.id).toBe(album.id);
      expect(result?.detail.albumId).toBe(album.id);
    }
  });

  it("provides five to ten fictional tracks for every album", () => {
    for (const detail of albumDetailsMock) {
      expect(detail.tracks.length).toBeGreaterThanOrEqual(5);
      expect(detail.tracks.length).toBeLessThanOrEqual(10);
      expect(new Set(detail.tracks.map((track) => track.id)).size).toBe(
        detail.tracks.length,
      );
    }
  });

  it("keeps detail-only company and tracks outside the base album record", () => {
    const album = albumsMock[0] as unknown as Record<string, unknown>;

    expect(album.company).toBeUndefined();
    expect(album.tracks).toBeUndefined();
    expect(getAlbumDetailById("mock-001")?.detail.company).toContain("虚构");
  });

  it("includes a missing company state", () => {
    expect(albumDetailsMock.some((detail) => detail.company === null)).toBe(true);
  });

  it("returns null for an unknown slug or id", () => {
    expect(getAlbumDetailBySlug("does-not-exist")).toBeNull();
    expect(getAlbumDetailById("does-not-exist")).toBeNull();
  });

  it("groups and sorts a double-disc album by disc and track number", () => {
    const tracks = getAlbumDetailById("mock-009")?.detail.tracks ?? [];
    const groups = groupTracksByDisc([...tracks].reverse());

    expect(groups.map((group) => group.discNumber)).toEqual([1, 2]);
    expect(groups[0].tracks.map((track) => track.trackNumber)).toEqual([1, 2, 3]);
    expect(groups[1].tracks.map((track) => track.trackNumber)).toEqual([1, 2, 3]);
  });

  it("formats millisecond durations as m:ss", () => {
    expect(formatDuration(198_000)).toBe("3:18");
    expect(formatDuration(65_999)).toBe("1:05");
  });

  it("formats rating counts for a Chinese interface", () => {
    expect(formatRatingCount(12_480)).toMatch(/12[,，]480/);
  });

  it("detects multi-artist and differing track credits", () => {
    expect(shouldShowTrackArtists(["甲", "乙"], ["甲"])).toBe(true);
    expect(shouldShowTrackArtists(["甲"], ["甲"])).toBe(false);
  });
});
