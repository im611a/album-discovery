import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalogData } from "./catalog-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalog = JSON.parse(await readFile(path.join(root, "src", "data", "generated", "catalog.json"), "utf8"));
const identities = JSON.parse(await readFile(path.join(root, "scripts", "catalog", "netease-identities.json"), "utf8"));
const rymSnapshot = JSON.parse(await readFile(path.join(root, "scripts", "catalog", "rym-taxonomy-snapshot.json"), "utf8"));
const result = validateCatalogData(catalog, identities, rymSnapshot);
for (const album of catalog.albums ?? []) {
  if (album.cover?.kind !== "local") continue;
  try {
    await access(path.join(root, "public", album.cover.src.replace(/^\//, "")));
  } catch {
    result.ok = false;
    result.errors.push(`${album.slug}: local cover file is missing.`);
  }
}
if (!result.ok) {
  console.error(result.errors.join("\n"));
  process.exit(1);
}
console.log(`Catalog valid: ${result.summary.albums} NetEase albums, ${result.summary.uniqueNeteaseAlbumIds} unique album IDs, ${result.summary.coreGenres} core genres.`);
console.log(JSON.stringify(result.summary, null, 2));
