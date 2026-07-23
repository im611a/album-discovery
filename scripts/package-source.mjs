import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "album-discovery-source.zip");
rmSync(output, { force: true });

const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
if (listed.status !== 0) process.exit(listed.status ?? 1);
const files = listed.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => existsSync(path.join(root, file)));
const result = spawnSync("tar", ["-a", "-c", "-f", output, ...files], { cwd: root, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Source archive created from ${files.length} repository files: ${output}`);
