import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(root, "artifacts");
const source = path.join(artifacts, "album-discovery-source.zip");
const site = path.join(artifacts, "album-discovery-static-site.zip");
const forbidden = /(^|\/)(\.git|node_modules|\.next|out|\.cache|\.pnpm-store|coverage)(\/|$)|(^|\/)\.env(?:\.|$)|cookie|token|secret/i;

function entries(archive) {
  if (!existsSync(archive)) throw new Error(`Missing archive: ${archive}`);
  const result = spawnSync("tar", ["-tf", archive], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unreadable archive: ${archive}`);
  return result.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/^\.\//, "").replace(/\\/g, "/"));
}

const sourceEntries = entries(source);
for (const required of ["package.json", "pnpm-lock.yaml", "README.md", "src/data/generated/catalog.json", "scripts/catalog/verified-identities.json"]) {
  if (!sourceEntries.includes(required)) throw new Error(`Source archive is missing ${required}`);
}
if (sourceEntries.some((entry) => forbidden.test(entry))) throw new Error("Source archive contains a forbidden path.");

const siteEntries = entries(site);
if (!siteEntries.includes("index.html")) throw new Error("Static archive does not have index.html at its root.");
if (siteEntries.some((entry) => forbidden.test(entry))) throw new Error("Static archive contains a forbidden path.");
if (siteEntries.some((entry) => /(^|\/)(package\.json|pnpm-lock\.yaml|src|scripts|docs)(\/|$)/.test(entry))) throw new Error("Static archive contains source-only files.");
const albumPages = siteEntries.filter((entry) => /^albums\/[^/]+\/index\.html$/.test(entry));
if (albumPages.length !== 120) throw new Error(`Expected 120 album pages in static archive, found ${albumPages.length}.`);
if (!siteEntries.some((entry) => entry.startsWith("_next/static/"))) throw new Error("Static archive is missing Next.js assets.");

const temporary = path.join(artifacts, ".delivery-verify");
rmSync(temporary, { recursive: true, force: true });
mkdirSync(temporary, { recursive: true });
const extract = spawnSync("tar", ["-xf", site, "-C", temporary], { cwd: root, stdio: "inherit" });
if (extract.status !== 0 || !readFileSync(path.join(temporary, "index.html"), "utf8").includes("<!DOCTYPE html")) throw new Error("Static archive extraction check failed.");
rmSync(temporary, { recursive: true, force: true });

console.log(`Delivery verified: ${sourceEntries.length} source entries, ${siteEntries.length} static entries, ${albumPages.length} album pages.`);
