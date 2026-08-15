import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBatchWorkspace, runDryRun } from "./pipeline.mjs";

function options(argv) {
  const result = { command: argv[0] };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    result[value.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

async function main() {
  const value = options(process.argv.slice(2));
  if (value.command === "create-batch") {
    if (!value.batch || !value.id || !value["discovered-at"]) throw new Error("create-batch requires --batch, --id and --discovered-at.");
    const root = await createBatchWorkspace(path.resolve(value.batch), { id: value.id, discoveredAt: value["discovered-at"] });
    console.log(JSON.stringify({ status: "CREATED", batchRoot: root, productionMutation: false }, null, 2));
    return;
  }
  if (value.command === "dry-run") {
    if (!value.batch) throw new Error("dry-run requires --batch.");
    const result = await runDryRun({ batchRoot: path.resolve(value.batch) });
    console.log(JSON.stringify({ status: "DRY_RUN_COMPLETE", counts: result.report.counts, resultFingerprint: result.report.resultFingerprint, report: path.join(result.paths.reportRoot, "report.md"), productionMutation: false }, null, 2));
    if (result.report.counts.FATAL > 0) process.exitCode = 2;
    return;
  }
  throw new Error("Usage: node scripts/catalog/content-pipeline/cli.mjs create-batch|dry-run --batch <path> [...].");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
