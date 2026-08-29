import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAlbumDiscoveryPresentation } from "../../src/catalog/discovery/presentation";
import { catalogAlbums, catalogIndexManifest } from "../../src/catalog/published-catalog";
import { expect, it } from "vitest";

const outputPath = join(process.cwd(), "src", "data", "generated", "homepage-relationship-index.json");

function buildSnapshot() {
  return {
    version: 1,
    authority: "buildAlbumDiscoveryPresentation",
    generatedFromCatalogIndexSha256: catalogIndexManifest.shards[0]?.sha256,
    relationships: catalogAlbums.map((album) => {
      const presentation = buildAlbumDiscoveryPresentation(album.id);
      return {
        albumId: album.id,
        options: presentation
          ? [presentation.primary, ...presentation.alternates]
            .filter((option) => option != null)
            .slice(0, 7)
            .map((option) => ({ albumId: option.target.id, lens: option.lens }))
          : [],
      };
    }),
  };
}

it("keeps the compact homepage relationship snapshot equal to the canonical discovery engine", () => {
  const snapshot = buildSnapshot();
  if (process.env.UPDATE_HOMEPAGE_RELATIONSHIP_INDEX === "1") {
    writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }
  expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(snapshot);
}, 30_000);
