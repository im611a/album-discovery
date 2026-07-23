import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../../src/data/generated/catalog.json", import.meta.url), "utf8"));
const coreGenres = catalog.taxonomy.filter((genre) => genre.kind === "core").map((genre) => ({
  key: genre.key,
  albums: catalog.albums.filter((album) => album.coreGenres.includes(genre.key)).length,
}));
console.log({
  refreshDate: catalog.refreshDate,
  albums: catalog.albums.length,
  guides: catalog.albums.filter((album) => album.editorial).length,
  localCovers: catalog.albums.filter((album) => album.cover.kind === "local").length,
  neteaseLinks: catalog.albums.filter((album) => album.externalUrl).length,
  coreGenres,
});
