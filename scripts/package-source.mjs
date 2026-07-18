import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });
const output = path.join(artifacts, "album-discovery-source.zip");
const result = spawnSync("git", ["archive", "--format=zip", `--output=${output}`, "HEAD"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Source archive created: ${output}`);
