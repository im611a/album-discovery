import path from "node:path";
import { OUTPUT_DIR, readJson } from "./lib/catalog-utils.mjs";

const catalog = await readJson(path.join(OUTPUT_DIR, "catalog.json"));
if (!catalog) throw new Error("Run catalog:refresh first.");
console.table(catalog.taxonomy.map((genre) => ({
  key: genre.key,
  label: genre.labelZh,
  albums: catalog.albums.filter((album) => album.primaryGenres.includes(genre.key)).length,
  flagships: catalog.albums.filter((album) => album.editorial && album.primaryGenres.includes(genre.key)).length,
})));
console.log({ refreshDate: catalog.refreshDate, albums: catalog.albums.length, flagships: catalog.albums.filter((album) => album.editorial).length, localCovers: catalog.albums.filter((album) => album.cover.kind === "local").length, outboundLinks: catalog.albums.reduce((sum, album) => sum + album.externalLinks.length, 0) });
