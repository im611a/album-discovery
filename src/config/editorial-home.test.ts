import { describe, expect, it, vi } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import {
  PHYSICAL_ARCHIVE_SLOTS,
  resolveConfiguredAlbums,
  resolvePhysicalArchiveAlbums,
} from "./editorial-home";

describe("physical archive home configuration", () => {
  it("uses six fixed cabinet slots with a restrained base-size ratio", () => {
    expect(PHYSICAL_ARCHIVE_SLOTS).toHaveLength(6);
    expect(new Set(PHYSICAL_ARCHIVE_SLOTS.map((slot) => slot.slot)).size).toBe(6);
    expect(new Set(PHYSICAL_ARCHIVE_SLOTS.map((slot) => slot.position)).size).toBe(6);
    expect(PHYSICAL_ARCHIVE_SLOTS.map((slot) => slot.index)).toEqual([1, 2, 3, 4, 5, 6]);
    const sizes = PHYSICAL_ARCHIVE_SLOTS.map((slot) => slot.baseSize);
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeLessThanOrEqual(1.6);
    expect(PHYSICAL_ARCHIVE_SLOTS.filter((slot) => slot.mobileVisible)).toHaveLength(2);
  });

  it("resolves configured albums to real unique catalog entries", () => {
    const resolved = resolvePhysicalArchiveAlbums(catalogAlbums);
    expect(resolved).toHaveLength(PHYSICAL_ARCHIVE_SLOTS.length);
    expect(new Set(resolved.map((item) => item.album.id)).size).toBe(resolved.length);
    expect(resolved.every((item) => catalogAlbums.includes(item.album))).toBe(true);
    expect(resolved.every((item) => item.usedFallback === false)).toBe(true);
  });

  it("uses a deterministic catalog fallback when a configured slug is missing", () => {
    const missing = [{ ...PHYSICAL_ARCHIVE_SLOTS[0], albumSlug: "missing-album" }];
    const onFallback = vi.fn();
    const first = resolvePhysicalArchiveAlbums(catalogAlbums, missing, onFallback);
    const second = resolvePhysicalArchiveAlbums(catalogAlbums, missing);
    expect(first[0]?.usedFallback).toBe(true);
    expect(first[0]?.album.id).toBe(second[0]?.album.id);
    expect(onFallback).toHaveBeenCalledWith(missing[0], first[0]?.album);
  });

  it("does not invent configured albums that are absent", () => {
    expect(resolveConfiguredAlbums(catalogAlbums, ["missing", catalogAlbums[0]!.slug]))
      .toEqual([catalogAlbums[0]]);
  });
});
