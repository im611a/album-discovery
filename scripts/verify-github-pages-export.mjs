import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (basePath !== "/album-discovery") throw new Error(`Unexpected GitHub Pages base path: ${basePath}`);
if (siteUrl !== "https://im611a.github.io/album-discovery") throw new Error(`Unexpected public site URL: ${siteUrl}`);

const requiredFiles = [
  "index.html",
  "explore/index.html",
  "search/index.html",
  "albums/ok-computer/index.html",
  "artists/artist-99384/index.html",
  "catalog/covers/detail/2060534.webp",
  "catalog/covers/thumb/2060534.webp",
  "homepage-production/vendor/three.module.min.txt",
  "robots.txt",
  "sitemap.xml",
  "404.html",
];
for (const relative of requiredFiles) {
  if (!existsSync(path.join(out, relative))) throw new Error(`Required GitHub Pages output is missing: ${relative}`);
}

const htmlFiles = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.name.endsWith(".html")) htmlFiles.push(absolute);
  }
}
walk(out);

let localhostReferences = 0;
let unprefixedRootReferences = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  if (html.includes("localhost:3000")) localhostReferences += 1;
  for (const match of html.matchAll(/\b(?:href|src)=["'](\/[^"']*)["']/gi)) {
    const value = match[1];
    if (value !== basePath && !value.startsWith(`${basePath}/`)) unprefixedRootReferences += 1;
  }
}

const robots = readFileSync(path.join(out, "robots.txt"), "utf8");
const sitemap = readFileSync(path.join(out, "sitemap.xml"), "utf8");
if (!robots.includes(`Allow: ${basePath}/`)) throw new Error("robots.txt does not allow the project-site base path.");
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) throw new Error("robots.txt has the wrong sitemap URL.");
if (!sitemap.includes(`<loc>${siteUrl}/albums/ok-computer</loc>`)) throw new Error("sitemap.xml has the wrong Album URL.");
if (localhostReferences || unprefixedRootReferences) {
  throw new Error(`GitHub Pages metadata/path drift: localhost=${localhostReferences}, unprefixed=${unprefixedRootReferences}`);
}

const files = [];
function measure(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) measure(absolute);
    else files.push({ path: path.relative(out, absolute).replaceAll("\\", "/"), bytes: statSync(absolute).size });
  }
}
measure(out);
const largest = files.reduce((current, item) => item.bytes > current.bytes ? item : current, { path: "", bytes: 0 });
console.log(JSON.stringify({
  basePath,
  siteUrl,
  files: files.length,
  bytes: files.reduce((sum, item) => sum + item.bytes, 0),
  htmlFiles: htmlFiles.length,
  largest,
  localhostReferences,
  unprefixedRootReferences,
}, null, 2));
