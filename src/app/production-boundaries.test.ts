import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";

describe("production delivery boundaries", () => {
  it("contains no fictional scores or production mock records", () => {
    const serialized = JSON.stringify(catalogAlbums);
    expect(serialized).not.toMatch(/rymRating|rymScore|fictional rating|mock album/i);
    expect(catalogAlbums).toHaveLength(120);
  });

  it("does not perform runtime provider network requests", () => {
    const files = ["src/catalog/published-catalog.ts", "src/catalog/queries.ts", "src/catalog/recommendation.ts", "src/features/personal-state/personal-state-provider.tsx"];
    for (const file of files) expect(readFileSync(resolve(file), "utf8")).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  });

  it("keeps every published external destination HTTPS and explicitly verified", () => {
    for (const album of catalogAlbums) for (const link of album.externalLinks) {
      expect(link.url.startsWith("https://")).toBe(true);
      expect(link.verified).toBe(true);
    }
  });

  it("does not publish inferred nationality, country, region, or language values", () => {
    for (const album of catalogAlbums) {
      expect(album).not.toHaveProperty("country");
      expect(album).not.toHaveProperty("region");
      expect(album).not.toHaveProperty("nationality");
      if (album.languages.status === "unavailable") expect(album.languages.values).toEqual([]);
    }
  });
});
