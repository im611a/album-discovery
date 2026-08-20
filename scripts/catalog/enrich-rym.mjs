import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalogData } from "./catalog-validation.mjs";
import { publishCatalog } from "./publish-catalog.mjs";
import { inspectRymInput } from "./rym-input.mjs";
import { buildRymEnrichment, collectRelevantRymRows, loadCheckpoint, reconcileRymSummaryWithCatalog, sha256File } from "./rym-enrichment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "src", "data", "generated", "catalog.json");
const identitiesPath = path.join(root, "scripts", "catalog", "netease-identities.json");
const snapshotPath = path.join(root, "scripts", "catalog", "rym-taxonomy-snapshot.json");
const summaryPath = path.join(root, "data", "rym", "enrichment-summary.json");
const reportPath = path.join(root, "reports", "catalog", "rym-enrichment-report.json");
const cacheRoot = path.join(root, ".cache", "catalog", "rym-enrichment");
const checkpointPath = path.join(cacheRoot, "checkpoint.json");

function parseArguments(argv) {
  const options = { command: "enrich", input: null, dryRun: false, resume: false, limit: null, sourceId: null };
  const args = [...argv];
  if (["inspect", "enrich", "report", "reconcile"].includes(args[0])) options.command = args.shift();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--input") options.input = path.resolve(args[++index]);
    else if (args[index] === "--dry-run") options.dryRun = true;
    else if (args[index] === "--resume") options.resume = true;
    else if (args[index] === "--limit") options.limit = Number(args[++index]);
    else if (args[index] === "--source-id") options.sourceId = args[++index];
    else if (args[index] === "--") continue;
    else throw new Error(`Unknown RYM enrichment option: ${args[index]}`);
  }
  if (!["report", "reconcile"].includes(options.command) && !options.input) throw new Error("--input is required.");
  if (options.limit != null && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit must be a positive integer.");
  return options;
}

const options = parseArguments(process.argv.slice(2));
if (options.command === "report") {
  console.log(await readFile(summaryPath, "utf8"));
  process.exit(0);
}
if (options.command === "reconcile") {
  const [catalog, summary] = await Promise.all([
    readFile(catalogPath, "utf8").then(JSON.parse),
    readFile(summaryPath, "utf8").then(JSON.parse),
  ]);
  const reconciled = reconcileRymSummaryWithCatalog(summary, catalog);
  const temporarySummary = `${summaryPath}.tmp`;
  await writeFile(temporarySummary, `${JSON.stringify(reconciled.summary, null, 2)}\n`, "utf8");
  await rename(temporarySummary, summaryPath);
  console.log(JSON.stringify({
    status: "RECONCILED",
    totalAlbums: reconciled.summary.totalAlbums,
    added: reconciled.added.map(({ neteaseAlbumId, slug, status }) => ({ neteaseAlbumId, slug, status })),
    sourceInputSha256: reconciled.summary.inputSha256,
  }, null, 2));
  process.exit(0);
}
const inputSha256 = await sha256File(options.input);
const inputSourceId = options.sourceId ?? `personal-research:${path.basename(options.input)}:${inputSha256.slice(0, 12)}`;
if (options.command === "inspect") {
  console.log(JSON.stringify({
    input: options.input,
    inputSourceId,
    inputSha256,
    ...(await inspectRymInput(options.input, inputSourceId)),
  }, null, 2));
  process.exit(0);
}

await mkdir(cacheRoot, { recursive: true });
const [catalog, identities, checkpoint] = await Promise.all([
  readFile(catalogPath, "utf8").then(JSON.parse),
  readFile(identitiesPath, "utf8").then(JSON.parse),
  options.resume ? loadCheckpoint(checkpointPath) : null,
]);
let relevantRows;
let inputRows;
let rejectedInputRows;
if (checkpoint?.inputSha256 === inputSha256 && Array.isArray(checkpoint.relevantRows)) {
  ({ relevantRows, inputRows, rejectedInputRows } = checkpoint);
} else {
  const collected = await collectRelevantRymRows(options.input, catalog, inputSourceId);
  relevantRows = collected.rows;
  inputRows = collected.read;
  rejectedInputRows = collected.rejectedInputRows;
  await writeFile(checkpointPath, `${JSON.stringify({ inputSha256, relevantRows, inputRows, rejectedInputRows }, null, 2)}\n`, "utf8");
}
const observedAt = new Date().toISOString();
const result = buildRymEnrichment(catalog, relevantRows, { inputSourceId, inputSha256, observedAt, limit: options.limit });
const validation = validateCatalogData(result.catalog, identities, result.snapshot);
if (!validation.ok) throw new Error(`RYM enriched catalog rejected:\n${validation.errors.join("\n")}`);
const report = {
  ...result.summary,
  inputRows,
  relevantInputRows: relevantRows.length,
  rejectedInputRows,
  dryRun: options.dryRun,
  resumed: Boolean(checkpoint?.inputSha256 === inputSha256),
  completedAt: new Date().toISOString(),
  inputClassification: "PERSONAL_RESEARCH_INPUT",
  rawInputPublished: false,
  results: result.results,
};
if (!options.dryRun) {
  const temporarySnapshot = `${snapshotPath}.tmp`;
  const previousSnapshot = await readFile(snapshotPath, "utf8");
  await writeFile(temporarySnapshot, `${JSON.stringify(result.snapshot, null, 2)}\n`, "utf8");
  await rename(temporarySnapshot, snapshotPath);
  try {
    await publishCatalog(result.catalog);
  } catch (error) {
    await writeFile(snapshotPath, previousSnapshot, "utf8");
    throw error;
  }
  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
const selectedReportPath = options.dryRun ? path.join(cacheRoot, "dry-run-report.json") : reportPath;
await mkdir(path.dirname(selectedReportPath), { recursive: true });
await writeFile(selectedReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
