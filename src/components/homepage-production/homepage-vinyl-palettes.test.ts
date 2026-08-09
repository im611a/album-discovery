import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_HOMEPAGE_MAPPING } from "./approved-homepage-mapping";
import {
  getHomepageStageVinylPalette,
  HOMEPAGE_STAGE_VINYL_PALETTES,
} from "./homepage-vinyl-palettes";

describe("homepage Stage vinyl palettes", () => {
  it("provides a deterministic local-cover palette for every approved Stage album", () => {
    expect(Object.keys(HOMEPAGE_STAGE_VINYL_PALETTES)).toEqual(
      APPROVED_HOMEPAGE_MAPPING.stage.map((entry) => entry.albumId),
    );
    for (const entry of APPROVED_HOMEPAGE_MAPPING.stage) {
      const palette = getHomepageStageVinylPalette(entry.albumId);
      expect(palette.dominant).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette.secondary).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set([palette.dominant, palette.secondary, palette.light]).size).toBe(3);
    }
  });

  it("pins every palette to the exact local cover asset that produced it", () => {
    for (const entry of APPROVED_HOMEPAGE_MAPPING.stage) {
      const palette = getHomepageStageVinylPalette(entry.albumId);
      const bytes = readFileSync(join(process.cwd(), "public", palette.sourceCover));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(palette.sourceCoverSha256);
    }
  });

  it("fails closed when a future Stage album has no derived cover palette", () => {
    expect(() => getHomepageStageVinylPalette("album:missing")).toThrow(/缺少本地封面色板/);
  });
});
