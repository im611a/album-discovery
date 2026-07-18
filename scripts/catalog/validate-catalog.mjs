import path from "node:path";
import { OUTPUT_DIR, ROOT, readJson } from "./lib/catalog-utils.mjs";
import { validateCatalog } from "./catalog-validation.mjs";

const catalog = await readJson(path.join(OUTPUT_DIR, "catalog.json"));
const identityDocument = await readJson(path.join(ROOT, "scripts", "catalog", "verified-identities.json"));
const issues = validateCatalog(catalog, identityDocument);
if (issues.length) {
  console.error(`Catalog validation failed with ${issues.length} issue(s):\n- ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n- ")}`);
  process.exit(1);
}
const flagshipCount = catalog.albums.filter((album) => album.editorial).length;
console.log(`Catalog valid: ${catalog.albums.length} fixed real-album identities, ${flagshipCount} flagship guides, ${catalog.taxonomy.length} primary genres.`);
