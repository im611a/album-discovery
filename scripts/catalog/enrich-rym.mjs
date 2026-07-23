import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalogData } from "./catalog-validation.mjs";
import { publishCatalog } from "./publish-catalog.mjs";
import { enrichCatalogWithRym, sha256File } from "./rym-enrichment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "src", "data", "generated", "catalog.json");
const identitiesPath = path.join(root, "scripts", "catalog", "netease-identities.json");
const snapshotPath = path.join(root, "scripts", "catalog", "rym-taxonomy-snapshot.json");
const reportPath = path.join(root, "reports", "catalog", "rym-enrichment-report.json");
const dryRunReportPath = path.join(root, ".cache", "catalog", "rym-enrichment-dry-run.json");

function parseArguments(argv) {
  const options = { input: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") options.input = path.resolve(argv[++index]);
    else if (argv[index] === "--dry-run") options.dryRun = true;
    else throw new Error(`Unknown RYM enrichment option: ${argv[index]}`);
  }
  if (!options.input) throw new Error("--input is required.");
  return options;
}

const options = parseArguments(process.argv.slice(2));
const [catalog, identities, input] = await Promise.all([
  readFile(catalogPath, "utf8").then(JSON.parse),
  readFile(identitiesPath, "utf8").then(JSON.parse),
  readFile(options.input, "utf8").then(JSON.parse),
]);
const result = enrichCatalogWithRym(catalog, input);
if (!result.ok) throw new Error(`RYM enrichment input rejected:\n${result.errors.join("\n")}`);
const validation = validateCatalogData(result.catalog, identities, result.snapshot);
if (!validation.ok) throw new Error(`RYM enriched catalog rejected:\n${validation.errors.join("\n")}`);
const report = {
  ...result.summary,
  dryRun: options.dryRun,
  dataset: input.dataset,
  inputSha256: await sha256File(options.input),
  importedFields: input.dataset.importedFields,
  completedAt: new Date().toISOString(),
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
}
const selectedReportPath = options.dryRun ? dryRunReportPath : reportPath;
await mkdir(path.dirname(selectedReportPath), { recursive: true });
await writeFile(selectedReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
