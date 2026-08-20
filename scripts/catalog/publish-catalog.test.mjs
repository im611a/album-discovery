import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildPublication } from "./publish-catalog.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("candidate catalog publication", () => {
  it("preserves N untouched baseline Albums when the candidate cover workspace contains only M additions", async () => {
    const production = JSON.parse(await readFile(path.resolve("src/data/generated/catalog.json"), "utf8"));
    const baselineAlbums = structuredClone(production.albums.slice(0, 4));
    const additions = baselineAlbums.slice(0, 3).map((album, index) => {
      const albumId = String(9_900_100 + index);
      return {
        ...structuredClone(album),
        internalId: `album:${albumId}`,
        id: `album:${albumId}`,
        neteaseAlbumId: albumId,
        slug: `candidate-publication-${albumId}`,
        title: `Candidate Publication ${albumId}`,
        cover: {
          ...album.cover,
          src: `/catalog/covers/detail/${albumId}.webp`,
          thumbnailSrc: `/catalog/covers/thumb/${albumId}.webp`,
        },
      };
    });
    const coverRoot = await mkdtemp(path.join(os.tmpdir(), "candidate-publication-covers-"));
    temporary.push(coverRoot);
    await Promise.all(["thumb", "detail"].map((directory) => mkdir(path.join(coverRoot, directory), { recursive: true })));
    await Promise.all(additions.flatMap((album) => [
      writeFile(path.join(coverRoot, "thumb", `${album.neteaseAlbumId}.webp`), "candidate-thumbnail"),
      writeFile(path.join(coverRoot, "detail", `${album.neteaseAlbumId}.webp`), "candidate-detail"),
    ]));

    const publication = await buildPublication(
      { ...production, albums: [...baselineAlbums, ...additions] },
      { coverRoot, touchedAlbumIds: additions.map((album) => album.neteaseAlbumId) },
    );

    expect(publication.catalog.albums.slice(0, baselineAlbums.length)).toEqual(baselineAlbums);
    expect(publication.catalog.albums.slice(baselineAlbums.length).map((album) => album.cover)).toEqual(
      additions.map((album) => ({
        ...album.cover,
        src: `/catalog/covers/detail/${album.neteaseAlbumId}.webp`,
        thumbnailSrc: `/catalog/covers/thumb/${album.neteaseAlbumId}.webp`,
      })),
    );
  });
});
