import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out");
if (!existsSync(path.join(out, "index.html"))) throw new Error("Static export is missing; run pnpm build first.");
const artifacts = path.join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });
const output = path.join(artifacts, "album-discovery-static-site.zip");
rmSync(output, { force: true });
const result = spawnSync("tar", ["-a", "-c", "-f", output, "-C", out, "."], { cwd: root, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Deployable static archive created: ${output}`);
