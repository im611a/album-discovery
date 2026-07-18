import path from "node:path";
import { OUTPUT_DIR, fetchWithPolicy, readJson } from "./lib/catalog-utils.mjs";

const catalog = await readJson(path.join(OUTPUT_DIR, "catalog.json"));
if (!catalog) throw new Error("Run catalog:refresh first.");
const links = catalog.albums.flatMap((album) => album.externalLinks.map((link) => ({ album: album.slug, ...link })));
const failures = [];
for (const [index, link] of links.entries()) {
  try {
    const response = await fetchWithPolicy(link.url, { gapMs: 750, attempts: 1, timeoutMs: 12000, fetchOptions: { method: "HEAD", redirect: "follow" }, accept: "text/html,*/*" });
    console.log(`[${index + 1}/${links.length}] ${link.platform} ${response.status} ${link.album}`);
  } catch (error) {
    failures.push({ ...link, error: error.message });
    console.error(`[${index + 1}/${links.length}] failed ${link.platform} ${link.album}: ${error.message}`);
  }
}
if (failures.length) { console.error(`${failures.length} outbound link(s) failed validation.`); process.exit(1); }
