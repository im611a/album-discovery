import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out");
if (!existsSync(path.join(out, "index.html"))) throw new Error("Static export is missing; run pnpm build first.");
const output = path.join(root, "album-discovery-static-site.zip");
const legacyOutput = path.join(root, "artifacts", "album-discovery-static-site.zip");
rmSync(output, { force: true });
rmSync(legacyOutput, { force: true });
const result = spawnSync("tar", ["-a", "-c", "-f", output, "-C", out, "."], { cwd: root, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Deployable static archive created: ${output}`);
