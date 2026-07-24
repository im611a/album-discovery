import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out");
if (!existsSync(path.join(out, "index.html"))) {
  throw new Error("Static export is missing; run pnpm build first.");
}

const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else files.push(absolute);
  }
}
walk(out);

const htmlFiles = files.filter((file) => file.endsWith(".html"));
const missing = new Set();
const forbidden = new Set();
const unexpectedRemoteResources = new Set();
let internalReferences = 0;
let resourceReferences = 0;

function resolveInternal(value, htmlFile) {
  const withoutFragment = value.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) return;
  const decoded = decodeURIComponent(withoutFragment);
  const relative = decoded.startsWith("/")
    ? decoded.slice(1)
    : path.relative(out, path.resolve(path.dirname(htmlFile), decoded)).replaceAll("\\", "/");
  const candidate = path.join(out, relative);
  const targets = path.extname(relative)
    ? [candidate]
    : [candidate, path.join(candidate, "index.html"), `${candidate}.html`];
  if (!targets.some(existsSync)) missing.add(`${path.relative(out, htmlFile)} -> ${value}`);
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(/\b(href|src)=["']([^"'<>]+)["']/gi)) {
    const [, attribute, value] = match;
    if (/^(?:data:|mailto:|tel:|#|javascript:)/i.test(value)) continue;
    if (/^[A-Za-z]:[\\/]|^file:\/\//i.test(value) || /meinhardtaxer\.com/i.test(value)) {
      forbidden.add(`${path.relative(out, htmlFile)} -> ${value}`);
      continue;
    }
    if (/^https?:\/\//i.test(value)) {
      if (attribute.toLowerCase() === "src") unexpectedRemoteResources.add(`${path.relative(out, htmlFile)} -> ${value}`);
      continue;
    }
    if (attribute.toLowerCase() === "src") resourceReferences += 1;
    else internalReferences += 1;
    resolveInternal(value, htmlFile);
  }
}

if (missing.size || forbidden.size || unexpectedRemoteResources.size) {
  const detail = [
    ...[...missing].map((item) => `missing: ${item}`),
    ...[...forbidden].map((item) => `forbidden: ${item}`),
    ...[...unexpectedRemoteResources].map((item) => `remote-resource: ${item}`),
  ].join("\n");
  throw new Error(`Static link validation failed:\n${detail}`);
}

console.log(JSON.stringify({
  htmlFiles: htmlFiles.length,
  internalReferences,
  resourceReferences,
  missingInternalLinks: 0,
  missingLocalResources: 0,
  forbiddenDiskOrReferencePaths: 0,
  unexpectedRemoteResources: 0,
}, null, 2));
