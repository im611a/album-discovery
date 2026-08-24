import { describe, expect, it } from "vitest";
import { catalogAlbums } from "../published-catalog";
import {
  buildAlbumDiscoveryPresentation,
  buildAlbumDiscoveryPresentationFromSearchParams,
} from "./presentation";

describe("R13-3C album discovery presentation", { timeout: 180_000 }, () => {
  it("adapts every published album to exactly one primary and no more than three alternates", () => {
    for (const album of catalogAlbums) {
      const presentation = buildAlbumDiscoveryPresentation(album.id);
      expect(presentation).not.toBeNull();
      expect(presentation?.primary).not.toBeNull();
      expect(presentation?.alternates.length).toBeLessThanOrEqual(3);
      const targetIds = [
        presentation?.primary?.target.id,
        ...presentation!.alternates.map((option) => option.target.id),
      ];
      expect(targetIds).not.toContain(album.id);
      expect(new Set(targetIds).size).toBe(targetIds.length);
      expect(presentation?.path.active).toBe(false);
    }
  });

  it("localizes only truthful structured evidence without exposing rank internals", () => {
    const serialized = JSON.stringify(catalogAlbums.map((album) => {
      const presentation = buildAlbumDiscoveryPresentation(album.id)!;
      return [presentation.primary, ...presentation.alternates].map((option) => ({
        lens: option?.lens,
        explanation: option?.explanation,
      }));
    }));
    expect(serialized).not.toMatch(/undefined|null|SPECIFIC|COMPOUND|FALLBACK|rankKey|candidatePool|相似度|匹配度|\d+%/);
    expect(serialized).toMatch(/核心流派|创作者时间线|相关流派线索|聆听场景/);
  });

  it("carries a bounded, reproducible path and avoids an immediate reversal", () => {
    const source = catalogAlbums.find((album) => album.slug === "wake-after-the-rain")!;
    const initial = buildAlbumDiscoveryPresentation(source.id)!;
    const first = initial.primary!;
    const query = new URL(first.href, "https://local.test").searchParams;
    const continued = buildAlbumDiscoveryPresentationFromSearchParams(first.target.id, query)!;
    const replay = buildAlbumDiscoveryPresentationFromSearchParams(first.target.id, query)!;

    expect(continued).toEqual(replay);
    expect(continued.path).toMatchObject({
      active: true,
      entryLabel: source.title,
      previousAlbumTitle: source.title,
      resetHref: `/albums/${first.target.slug}/`,
    });
    expect(continued.primary?.target.id).not.toBe(source.id);
    const nextQuery = new URL(continued.primary!.href, "https://local.test").searchParams;
    expect(nextQuery.get("entry")).toBe("album");
    expect(nextQuery.get("entryKey")).toBe(source.slug);
    expect(nextQuery.get("trail")?.split("~").length).toBeLessThanOrEqual(3);
    expect(nextQuery.get("via")?.split("~").length).toBeLessThanOrEqual(3);
  });

  it("drops malformed query context and keeps canonical release content", () => {
    const source = catalogAlbums[0];
    const canonical = buildAlbumDiscoveryPresentation(source.id)!;
    const malformed = buildAlbumDiscoveryPresentationFromSearchParams(
      source.id,
      `entry=artist&entryKey=missing&trail=${"x".repeat(513)}&via=BAD`,
    );
    expect(malformed).toEqual(canonical);
  });
});
