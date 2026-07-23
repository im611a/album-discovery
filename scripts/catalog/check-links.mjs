import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../../src/data/generated/catalog.json", import.meta.url), "utf8"));
const invalid = catalog.albums.filter((album) => album.externalUrl !== `https://music.163.com/#/album?id=${album.neteaseAlbumId}`);
if (invalid.length) {
  console.error(`Invalid NetEase album links: ${invalid.map((album) => album.slug).join(", ")}`);
  process.exit(1);
}
console.log(`Verified ${catalog.albums.length} deterministic NetEase album links without network requests.`);
