import { describe, expect, it, vi } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import {
  EDITORIAL_ALBUM_SLOTS,
  resolveConfiguredAlbums,
  resolveEditorialAlbums,
} from "./editorial-home";

describe("editorial home configuration", () => {
  it("uses a stable twelve-column contract without random coordinates", () => {
    expect(EDITORIAL_ALBUM_SLOTS).toHaveLength(9);
    expect(EDITORIAL_ALBUM_SLOTS.every((slot) => slot.gridColumn.includes("span"))).toBe(true);
    expect(EDITORIAL_ALBUM_SLOTS.every((slot) => slot.gridRow.includes("span"))).toBe(true);
    expect(new Set(EDITORIAL_ALBUM_SLOTS.map((slot) => slot.slot)).size).toBe(9);
  });

  it("resolves configured albums to real unique catalog entries", () => {
    const resolved = resolveEditorialAlbums(catalogAlbums);
    expect(resolved).toHaveLength(EDITORIAL_ALBUM_SLOTS.length);
    expect(new Set(resolved.map((item) => item.album.id)).size).toBe(resolved.length);
    expect(resolved.every((item) => catalogAlbums.includes(item.album))).toBe(true);
    expect(resolved.every((item) => item.usedFallback === false)).toBe(true);
  });

  it("uses a deterministic catalog fallback when a configured slug is missing", () => {
    const missing = [{ ...EDITORIAL_ALBUM_SLOTS[0], albumSlug: "missing-album" }];
    const onFallback = vi.fn();
    const first = resolveEditorialAlbums(catalogAlbums, missing, onFallback);
    const second = resolveEditorialAlbums(catalogAlbums, missing);
    expect(first[0]?.usedFallback).toBe(true);
    expect(first[0]?.album.id).toBe(second[0]?.album.id);
    expect(onFallback).toHaveBeenCalledWith(missing[0], first[0]?.album);
  });

  it("does not invent configured albums that are absent", () => {
    expect(resolveConfiguredAlbums(catalogAlbums, ["missing", catalogAlbums[0]!.slug]))
      .toEqual([catalogAlbums[0]]);
  });
});
