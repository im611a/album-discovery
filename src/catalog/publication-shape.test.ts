import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogAlbums, catalogIndexManifest, publishedArtists } from "./published-catalog";

describe("large catalog publication shape", () => {
  it("keeps list records lightweight and free of full detail fields", () => {
    for (const album of catalogAlbums) {
      for (const field of ["tracks", "company", "externalUrl", "source", "updatedAt", "descriptors"]) {
        expect(album).not.toHaveProperty(field);
      }
      expect(album.thumbnailPath).toMatch(/^\/catalog\/covers\/thumb\/\d+\.webp$/);
    }
  });

  it("publishes exactly one independent detail file per album", () => {
    const directory = path.join(process.cwd(), "src", "data", "generated", "album-details");
    const files = readdirSync(directory).filter((file) => file.endsWith(".json"));
    expect(files).toHaveLength(catalogAlbums.length);
    const sample = JSON.parse(readFileSync(path.join(directory, files[0]), "utf8"));
    expect(sample.tracks.length).toBe(sample.trackCount);
    expect(sample.externalUrl).toMatch(/^https:\/\/music\.163\.com\/#\/album\?id=\d+$/);
  });

  it("publishes an independent artist index", () => {
    expect(publishedArtists.length).toBeGreaterThan(200);
    expect(publishedArtists.every((artist) => artist.albumIds.length === artist.albumCount)).toBe(true);
  });

  it("publishes a versioned lightweight-index manifest without track duplication", () => {
    expect(catalogIndexManifest).toMatchObject({ version: 1, catalogCount: catalogAlbums.length, shardCount: 1 });
    expect(catalogIndexManifest.shards).toHaveLength(1);
    expect(catalogIndexManifest.shards[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(catalogAlbums.every((album) => !Object.hasOwn(album, "tracks"))).toBe(true);
  });
});
