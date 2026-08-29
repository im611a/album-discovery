import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import visualIndexJson from "@/data/generated/album-visual-index.json";
import { catalogAlbums } from "@/catalog/published-catalog";
import { describe, expect, it } from "vitest";
import { buildHomepageExperienceData, CHROMATIC_TAXONOMY } from "./homepage-experience-data";

describe("homepage experience data", () => {
  const experience = buildHomepageExperienceData();

  it("adapts the complete published catalog without introducing a second identity authority", () => {
    expect(Object.keys(experience.albums)).toHaveLength(catalogAlbums.length);
    expect(Object.keys(experience.relationships)).toHaveLength(catalogAlbums.length);
    for (const album of catalogAlbums) {
      expect(experience.albums[album.id]?.slug).toBe(album.slug);
      expect(experience.relationships[album.id]?.length).toBeLessThanOrEqual(7);
      expect(experience.relationships[album.id]).not.toContainEqual(expect.objectContaining({ albumId: album.id }));
      for (const option of experience.relationships[album.id] ?? []) {
        expect(experience.albums[option.albumId]).toBeDefined();
        expect(option.lens.length).toBeGreaterThan(0);
      }
    }
  });

  it("provides 6–12 deterministic representatives for the exact chromatic taxonomy", () => {
    expect(Object.keys(experience.chromaticAlbumIds)).toEqual(CHROMATIC_TAXONOMY);
    for (const tag of CHROMATIC_TAXONOMY) {
      const ids = experience.chromaticAlbumIds[tag];
      expect(ids.length).toBeGreaterThanOrEqual(6);
      expect(ids.length).toBeLessThanOrEqual(12);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(experience.albums[id]?.visualColorTags).toContain(tag);
    }
  });

  it("binds all derived records to the exact local cover bytes", () => {
    for (const record of visualIndexJson.albums) {
      const bytes = readFileSync(join(process.cwd(), "public", ...record.sourceCover.split("/").filter(Boolean)));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sourceCoverSha256);
    }
  });
});
