import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../../src/data/generated/catalog.json", import.meta.url), "utf8"));
const rymAudit = JSON.parse(await readFile(new URL("../../reports/catalog/rym-taxonomy-audit.json", import.meta.url), "utf8"));
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
  rymMatched: rymAudit.matched,
  rymUnmatched: rymAudit.unmatched,
  relatedGenreAssignments: catalog.albums.reduce((total, album) => total + album.relatedGenres.length, 0),
  descriptorAssignments: catalog.albums.reduce((total, album) => total + album.descriptors.length, 0),
  coreGenres,
});
