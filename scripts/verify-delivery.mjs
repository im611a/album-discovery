import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourceArgument = process.argv.indexOf("--source");
const siteArgument = process.argv.indexOf("--static");
const source = sourceArgument >= 0 ? path.resolve(process.argv[sourceArgument + 1]) : path.join(root, "album-discovery-source.zip");
const site = siteArgument >= 0 ? path.resolve(process.argv[siteArgument + 1]) : path.join(root, "album-discovery-static-site.zip");
const legacyArchives = [
  path.join(root, "artifacts", "album-discovery-source.zip"),
  path.join(root, "artifacts", "album-discovery-static-site.zip"),
];
const forbidden = /(^|\/)(\.git|node_modules|\.next|out|\.cache|\.local-data|\.pnpm-store|coverage)(\/|$)|(^|\/)\.env(?:\.|$)|cookie|token|secret/i;

if (sourceArgument < 0 && siteArgument < 0 && legacyArchives.some(existsSync)) {
  throw new Error("Stale legacy delivery archives remain under artifacts; regenerate both root delivery archives.");
}

function entries(archive) {
  if (!existsSync(archive)) throw new Error(`Missing archive: ${archive}`);
  const result = spawnSync("tar", ["-tf", archive], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unreadable archive: ${archive}`);
  return result.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/^\.\//, "").replace(/\\/g, "/"));
}

const sourceEntries = entries(source);
for (const required of ["package.json", "pnpm-lock.yaml", "README.md", "src/data/generated/catalog.json", "scripts/catalog/netease-identities.json", "scripts/catalog/rym-taxonomy-snapshot.json", "data/rym/enrichment-summary.json", "reports/catalog/rym-enrichment-report.json"]) {
  if (!sourceEntries.includes(required)) throw new Error(`Source archive is missing ${required}`);
}
if (sourceEntries.some((entry) => forbidden.test(entry))) throw new Error("Source archive contains a forbidden path.");

const siteEntries = entries(site);
if (!siteEntries.includes("index.html")) throw new Error("Static archive does not have index.html at its root.");
if (!siteEntries.includes("release-manifest.json")) throw new Error("Static archive does not have release-manifest.json at its root.");
if (!siteEntries.includes("explore/index.html")) throw new Error("Static archive does not include /explore/.");
for (const required of ["genres/index.html", "scenes/index.html", "decades/index.html"]) {
  if (!siteEntries.includes(required)) throw new Error(`Static archive does not include ${required}.`);
}
if (!siteEntries.includes("about/index.html")) throw new Error("Static archive does not include /about/.");
if (siteEntries.some((entry) => forbidden.test(entry))) throw new Error("Static archive contains a forbidden path.");
if (siteEntries.some((entry) => /(^|\/)(package\.json|pnpm-lock\.yaml|src|scripts|docs)(\/|$)/.test(entry))) throw new Error("Static archive contains source-only files.");
const catalog = JSON.parse(readFileSync(path.join(root, "src", "data", "generated", "catalog.json"), "utf8"));
const albumPages = siteEntries.filter((entry) => /^albums\/[^/]+\/index\.html$/.test(entry));
const artistPages = siteEntries.filter((entry) => /^artists\/[^/]+\/index\.html$/.test(entry));
if (albumPages.length !== catalog.albums.length) throw new Error(`Expected ${catalog.albums.length} album pages in static archive, found ${albumPages.length}.`);
const artists = JSON.parse(readFileSync(path.join(root, "src", "data", "generated", "artist-index.json"), "utf8"));
if (artistPages.length !== artists.artists.length) throw new Error(`Expected ${artists.artists.length} artist pages in static archive, found ${artistPages.length}.`);
if (siteEntries.some((entry) => /^catalog\/covers\/\d+\.jpg$/i.test(entry))) throw new Error("Static archive contains unoptimized original cover files.");
if (!siteEntries.some((entry) => entry.startsWith("_next/static/"))) throw new Error("Static archive is missing Next.js assets.");
const releaseManifest = JSON.parse(readFileSync(path.join(root, "out", "release-manifest.json"), "utf8"));
const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
if (releaseManifest.commit !== commit) throw new Error(`Static release manifest commit ${releaseManifest.commit} does not match HEAD ${commit}.`);
if (releaseManifest.ratedAlbumCount !== catalog.albums.filter((album) => album.rymRating != null).length ||
    releaseManifest.relatedGenreAlbumCount !== catalog.albums.filter((album) => album.relatedGenres.length > 0).length ||
    releaseManifest.explorationVersion !== 1 ||
    releaseManifest.visualDesignVersion !== "1.1" ||
    releaseManifest.designSystem !== "editorial-songti" ||
    releaseManifest.animationEngine !== "animejs") {
  throw new Error("Static release manifest does not match the enriched catalog.");
}

const temporary = path.join(root, "artifacts", ".delivery-verify");
rmSync(temporary, { recursive: true, force: true });
mkdirSync(temporary, { recursive: true });
const extract = spawnSync("tar", ["-xf", site, "-C", temporary], { cwd: root, stdio: "inherit" });
if (extract.status !== 0 || !readFileSync(path.join(temporary, "index.html"), "utf8").includes("<!DOCTYPE html")) throw new Error("Static archive extraction check failed.");
const extractedManifest = JSON.parse(readFileSync(path.join(temporary, "release-manifest.json"), "utf8"));
if (extractedManifest.commit !== commit) throw new Error("Extracted static archive belongs to a stale commit.");
rmSync(temporary, { recursive: true, force: true });

console.log(`Delivery verified: ${sourceEntries.length} source entries, ${siteEntries.length} static entries, ${albumPages.length} album pages.`);
