import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out");
if (!existsSync(path.join(out, "index.html"))) throw new Error("Static export is missing; run pnpm build first.");
const output = path.join(root, "album-discovery-static-site.zip");
const legacyOutput = path.join(root, "artifacts", "album-discovery-static-site.zip");
const catalog = JSON.parse(readFileSync(path.join(root, "src", "data", "generated", "catalog-index.json"), "utf8"));
const artists = JSON.parse(readFileSync(path.join(root, "src", "data", "generated", "artist-index.json"), "utf8"));
const commitResult = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
const branchResult = spawnSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" });
const countIndexPages = (directory) => readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
  const value = path.join(directory, entry.name);
  return total + (entry.isDirectory() ? countIndexPages(value) : entry.name === "index.html" ? 1 : 0);
}, 0);
const releaseManifest = {
  commit: commitResult.stdout.trim(),
  branch: branchResult.stdout.trim(),
  builtAt: new Date().toISOString(),
  catalogCount: catalog.albums.length,
  artistCount: artists.artists.length,
  staticPageCount: countIndexPages(out),
};
writeFileSync(path.join(out, "release-manifest.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");
rmSync(output, { force: true });
rmSync(legacyOutput, { force: true });
const result = spawnSync("tar", ["-a", "-c", "-f", output, "--exclude=./catalog/covers/*.jpg", "-C", out, "."], { cwd: root, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Deployable static archive created: ${output}`);
console.log(JSON.stringify(releaseManifest, null, 2));
