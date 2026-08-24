#!/usr/bin/env node
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { acquireBatch } from "./acquisition.mjs";
import { assertDiscoveryBaselineCurrent, parseDiscoveryTypes, runDiscovery } from "./discovery.mjs";
import { withLocks } from "./operator-locks.mjs";
import { createBatchWorkspace, directoryFingerprint, runDryRun } from "./pipeline.mjs";
import { finalizeAcquisition, readAcquisitionFinalization } from "./quarantine.mjs";
import { reviewTemplate, validateReviewDecisionArtifact } from "./review.mjs";
import { applyTaxonomyDecisions, buildTaxonomyProposal, readTaxonomyProposal, TAXONOMY_DECISIONS_SCHEMA } from "./taxonomy-assist.mjs";
import { inspectTransaction, prepareTransaction, promoteTransaction, recoverTransaction } from "./transaction.mjs";
import { sha256File, stableJson } from "./utils.mjs";

const run = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultWorkspaceRoot = path.join(repositoryRoot, ".local-data", "content-pipeline-v1");
const RESULT_SCHEMA = "content-pipeline-v1/operator-result/v1";
const EXIT = Object.freeze({ success: 0, usage: 2, input: 3, acquisition: 4, review: 5, preflight: 6, authorization: 7, transaction: 8, internal: 9 });
const commands = new Set(["doctor", "discover", "acquire", "finalize-acquisition", "taxonomy", "dry-run", "status", "review", "prepare", "promote", "recover", "help"]);
const booleanOptions = new Set(["json", "refresh", "verbose", "from-current-artists"]);
const valueOptions = new Set(["input", "batch", "apply", "transaction", "candidate-fingerprint", "concurrency", "limit", "artist-limit", "types"]);

function operatorError(code, message, exitCategory = "input") { return Object.assign(new Error(`${code}: ${message}`), { code, exitCategory }); }
function inside(root, target) { const relative = path.relative(path.resolve(root), path.resolve(target)); return !relative.startsWith("..") && !path.isAbsolute(relative); }
async function exists(file) { try { return await stat(file); } catch (error) { if (error?.code === "ENOENT") return null; throw error; } }

export function parseOperatorArguments(argv) {
  const command = String(argv[0] ?? "help").toLocaleLowerCase("en-US");
  if (!commands.has(command)) throw operatorError("UNKNOWN_COMMAND", `Unknown command: ${command}`, "usage");
  const options = { command };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw operatorError("UNEXPECTED_ARGUMENT", token, "usage");
    const name = token.slice(2).toLocaleLowerCase("en-US");
    if (booleanOptions.has(name)) { if (options[name]) throw operatorError("DUPLICATE_OPTION", token, "usage"); options[name] = true; continue; }
    if (!valueOptions.has(name)) throw operatorError("UNKNOWN_OPTION", token, "usage");
    if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) throw operatorError("MISSING_OPTION_VALUE", token, "usage");
    if (options[name] !== undefined) throw operatorError("DUPLICATE_OPTION", token, "usage");
    options[name] = argv[++index];
  }
  return options;
}

function validateCommandOptions(options) {
  const common = ["command", "json", "verbose"];
  const allowed = {
    help: common, doctor: common,
    discover: [...common, "refresh", "concurrency", "limit", "artist-limit", "types", "from-current-artists"],
    acquire: [...common, "input", "batch", "refresh", "concurrency"],
    "finalize-acquisition": [...common, "batch"],
    taxonomy: [...common, "batch"],
    "dry-run": [...common, "input", "batch"],
    status: [...common, "batch"],
    review: [...common, "batch", "apply"],
    prepare: [...common, "batch"],
    promote: [...common, "batch", "transaction", "candidate-fingerprint"],
    recover: [...common, "batch"],
  }[options.command];
  const irrelevant = Object.keys(options).filter((key) => !allowed.includes(key));
  if (irrelevant.length) throw operatorError("OPTION_NOT_VALID_FOR_COMMAND", irrelevant.join(", "), "usage");
  if (["acquire", "dry-run"].includes(options.command) && Boolean(options.input) === Boolean(options.batch)) throw operatorError("EXACTLY_ONE_INPUT_OR_BATCH_REQUIRED", options.command, "usage");
  if (options.concurrency !== undefined && (!/^\d+$/u.test(options.concurrency) || Number(options.concurrency) < 1 || Number(options.concurrency) > 4)) throw operatorError("INVALID_CONCURRENCY", "Use an integer from 1 through 4.", "usage");
  if (options.limit !== undefined && (!/^\d+$/u.test(options.limit) || Number(options.limit) < 1)) throw operatorError("INVALID_DISCOVERY_LIMIT", "Use a positive integer.", "usage");
  if (options["artist-limit"] !== undefined && (!/^\d+$/u.test(options["artist-limit"]) || Number(options["artist-limit"]) < 1)) throw operatorError("INVALID_ARTIST_LIMIT", "Use a positive integer.", "usage");
  if (options.types !== undefined) parseDiscoveryTypes(options.types);
}

function contextFromEnvironment(environment = process.env) {
  if (environment.NODE_ENV === "test" && environment.CONTENT_PIPELINE_OPERATOR_TEST_ROOT) {
    const root = path.resolve(environment.CONTENT_PIPELINE_OPERATOR_TEST_ROOT);
    if (!inside(os.tmpdir(), root)) throw operatorError("UNSAFE_TEST_ROOT", root, "preflight");
    return { repositoryRoot: root, workspaceRoot: path.join(root, ".local-data", "content-pipeline-v1"), catalogPath: path.join(root, "production", "generated", "catalog.json"), artistIndexPath: path.join(root, "production", "generated", "artist-index.json"), generatedRoot: path.join(root, "production", "generated"), coverRoot: path.join(root, "production", "covers"), identitiesPath: path.join(root, "fixtures", "netease-identities.json"), rymSnapshotPath: path.join(root, "fixtures", "rym-taxonomy-snapshot.json"), legacyDiscoveryCacheRoot: path.join(root, ".cache", "catalog", "netease") };
  }
  return { repositoryRoot, workspaceRoot: defaultWorkspaceRoot, catalogPath: path.join(repositoryRoot, "src", "data", "generated", "catalog.json"), artistIndexPath: path.join(repositoryRoot, "src", "data", "generated", "artist-index.json"), generatedRoot: path.join(repositoryRoot, "src", "data", "generated"), coverRoot: path.join(repositoryRoot, "public", "catalog", "covers"), identitiesPath: path.join(repositoryRoot, "scripts", "catalog", "netease-identities.json"), rymSnapshotPath: path.join(repositoryRoot, "scripts", "catalog", "rym-taxonomy-snapshot.json"), legacyDiscoveryCacheRoot: path.join(repositoryRoot, ".cache", "catalog", "netease") };
}

function batchIdFromOption(value) {
  const id = String(value ?? "");
  if (!/^CONTENT-BATCH-\d{8}-\d{3}$/u.test(id)) throw operatorError("INVALID_BATCH_ID", "Batch must match CONTENT-BATCH-YYYYMMDD-NNN.");
  return id;
}

async function allocateBatch(ctx) {
  await mkdir(ctx.workspaceRoot, { recursive: true });
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  for (let sequence = 1; sequence <= 999; sequence += 1) {
    const id = `CONTENT-BATCH-${day}-${String(sequence).padStart(3, "0")}`;
    if (!(await exists(path.join(ctx.workspaceRoot, id)))) return id;
  }
  throw operatorError("BATCH_ID_EXHAUSTED", day, "preflight");
}

async function createBatchForInput(ctx, input) {
  const source = path.resolve(input);
  const info = await exists(source);
  if (!info?.isFile()) throw operatorError("INPUT_NOT_FOUND", source);
  const extension = path.extname(source).toLocaleLowerCase("en-US");
  if (![".csv", ".tsv", ".json", ".jsonl", ".ndjson"].includes(extension)) throw operatorError("INPUT_FORMAT_UNSUPPORTED", extension);
  let discoveryBinding = null;
  try { discoveryBinding = await assertDiscoveryBaselineCurrent(source, ctx.catalogPath); }
  catch (error) { throw operatorError(error.code ?? "DISCOVERY_INPUT_INVALID", String(error.message), "preflight"); }
  const id = await allocateBatch(ctx);
  const root = path.join(ctx.workspaceRoot, id);
  const relativeInput = `input/input${extension}`;
  await createBatchWorkspace(root, { id, discoveredAt: new Date().toISOString(), input: relativeInput });
  await cp(source, path.join(root, relativeInput), { force: true });
  const configFile = path.join(root, "batch.json");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  config.operator = { sourceInputSha256: await sha256File(source), sourceName: path.basename(source), discovery: discoveryBinding };
  await writeFile(configFile, stableJson(config), "utf8");
  return { id, root };
}

async function resolveBatch(ctx, options, { allowInput = false } = {}) {
  if (options.batch) { const id = batchIdFromOption(options.batch); const root = path.join(ctx.workspaceRoot, id); if (!(await exists(root))) throw operatorError("BATCH_NOT_FOUND", id); return { id, root }; }
  if (allowInput && options.input) return createBatchForInput(ctx, options.input);
  throw operatorError("BATCH_REQUIRED", "Specify --batch (or --input for acquire/dry-run).", "usage");
}

function envelope(command, data = {}) { return { schema: RESULT_SCHEMA, command, status: data.status ?? "OK", batchId: data.batchId ?? null, exitCategory: data.exitCategory ?? "success", message: data.message ?? null, nextAction: data.nextAction ?? null, artifacts: data.artifacts ?? {}, counts: data.counts ?? {}, fingerprints: data.fingerprints ?? {}, warnings: data.warnings ?? [], errors: data.errors ?? [], ...data.extra }; }
function lockSet(ctx, batch, command, production = false) {
  const transactionState = async () => {
    const journal = path.join(batch.root, "transaction", "journal.json");
    if (!(await exists(journal))) return null;
    return (await inspectTransaction(path.dirname(journal))).state;
  };
  const values = [{ file: path.join(batch.root, ".operator.lock"), options: { command, batchId: batch.id, transactionState } }];
  if (production) values.unshift({ file: path.join(ctx.workspaceRoot, ".production-writer.lock"), options: { command, batchId: batch.id, transactionState } });
  return values;
}

async function snapshotQualification(ctx, batch, result) {
  const config = JSON.parse(await readFile(path.join(batch.root, "batch.json"), "utf8"));
  const [payloads, covers] = await Promise.all([directoryFingerprint(path.join(batch.root, "input", "payloads")), directoryFingerprint(path.join(batch.root, "incoming-covers"))]);
  const qualification = {
    schema: "content-pipeline-v1/operator-qualification/v1",
    batchId: batch.id,
    inputSha256: await sha256File(path.join(batch.root, config.operator?.activeInput ?? config.input)),
    baselineCatalogSha256: await sha256File(ctx.catalogPath),
    payloadFingerprint: payloads.fingerprint,
    coverFingerprint: covers.fingerprint,
    planSha256: await sha256File(path.join(batch.root, "plan", "plan.json")),
    reportSha256: await sha256File(path.join(batch.root, "report", "report.json")),
    candidateFingerprint: result.plan.candidate.fingerprint,
    resultFingerprint: result.report.resultFingerprint,
    reviewFingerprint: result.plan.review.fingerprint,
  };
  await mkdir(path.join(batch.root, "operator"), { recursive: true });
  await writeFile(path.join(batch.root, "operator", "qualification.json"), stableJson(qualification), "utf8");
  return qualification;
}

async function readQualification(ctx, batch) {
  const [plan, report] = await Promise.all([readFile(path.join(batch.root, "plan", "plan.json"), "utf8").then(JSON.parse), readFile(path.join(batch.root, "report", "report.json"), "utf8").then(JSON.parse)]);
  const actualCandidate = await directoryFingerprint(path.join(batch.root, "candidate"));
  const config = JSON.parse(await readFile(path.join(batch.root, "batch.json"), "utf8"));
  const inputSha256 = await sha256File(path.join(batch.root, config.operator?.activeInput ?? config.input));
  const qualification = JSON.parse(await readFile(path.join(batch.root, "operator", "qualification.json"), "utf8"));
  const [payloads, covers] = await Promise.all([directoryFingerprint(path.join(batch.root, "input", "payloads")), directoryFingerprint(path.join(batch.root, "incoming-covers"))]);
  const drift = [];
  if (actualCandidate.fingerprint !== plan.candidate.fingerprint) drift.push("CANDIDATE_DRIFT");
  if (inputSha256 !== report.input.sha256) drift.push("INPUT_DRIFT");
  if (qualification.batchId !== batch.id || qualification.inputSha256 !== inputSha256) drift.push("QUALIFICATION_IDENTITY_DRIFT");
  if (qualification.candidateFingerprint !== plan.candidate.fingerprint || qualification.resultFingerprint !== report.resultFingerprint) drift.push("QUALIFICATION_FINGERPRINT_DRIFT");
  if (qualification.baselineCatalogSha256 !== await sha256File(ctx.catalogPath) || qualification.baselineCatalogSha256 !== plan.baseline.catalogSha256) drift.push("BASELINE_DRIFT");
  if (qualification.payloadFingerprint !== payloads.fingerprint) drift.push("PAYLOAD_DRIFT");
  if (qualification.coverFingerprint !== covers.fingerprint) drift.push("COVER_DRIFT");
  if (qualification.planSha256 !== await sha256File(path.join(batch.root, "plan", "plan.json"))) drift.push("PLAN_DRIFT");
  if (qualification.reportSha256 !== await sha256File(path.join(batch.root, "report", "report.json"))) drift.push("REPORT_DRIFT");
  let reviewFingerprint = null;
  const reviewFile = path.join(batch.root, "review", "review-decisions.json");
  if (await exists(reviewFile)) reviewFingerprint = validateReviewDecisionArtifact(JSON.parse(await readFile(reviewFile, "utf8")), { batchId: batch.id, inputSha256, albumIds: report.records.map((record) => record.albumId) }).fingerprint;
  if (reviewFingerprint !== qualification.reviewFingerprint || reviewFingerprint !== plan.review.fingerprint) drift.push("REVIEW_DRIFT");
  const accountingKeys = ["READY", "REJECTED_BY_REVIEW", "QUARANTINED", "NEEDS_REVIEW", "ERROR", "FATAL", "SKIPPED_DUPLICATE", "IMPORTED"];
  const accountedRows = accountingKeys.reduce((sum, key) => sum + Number(report.counts[key] ?? 0), 0);
  if (accountedRows !== report.counts.rowsTotal) drift.push("ROW_ACCOUNTING_INCOMPLETE");
  return { plan, report, qualification, actualCandidate, inputSha256, drift: [...new Set(drift)], promotable: drift.length === 0 && report.counts.READY > 0 && report.counts.NEEDS_REVIEW === 0 && report.counts.ERROR === 0 && report.counts.FATAL === 0 };
}

async function journalState(batch) {
  const root = path.join(batch.root, "transaction");
  if (!(await exists(path.join(root, "journal.json")))) return null;
  return inspectTransaction(root);
}

async function execute(options, ctx = contextFromEnvironment()) {
  const command = options.command;
  if (command === "help") return envelope(command, { status: "HELP", message: "doctor | discover | acquire | finalize-acquisition --batch ID | taxonomy --batch ID | dry-run | status | review [--apply FILE] | prepare | promote | recover", extra: { commands: { discover: { description: "Discovers NetEase Album candidates from public enumeration sources.", network: true, productionMutation: false }, acquire: { description: "Fetches Album payloads and covers for explicit discovered IDs.", network: true, productionMutation: false }, "finalize-acquisition": { description: "Quarantines deterministic source defects/failures and derives a clean local input view.", network: false, productionMutation: false }, taxonomy: { description: "Builds grouped, evidence-backed core-genre proposals for human review.", network: false, productionMutation: false }, prepare: { network: false, productionMutation: false }, promote: { network: false, productionMutation: true } } } });
  if (command === "doctor") {
    const [catalog, artistIndex, details, git, node, ffprobe, ffmpeg] = await Promise.all([
      readFile(ctx.catalogPath, "utf8").then(JSON.parse),
      readFile(path.join(ctx.generatedRoot, "artist-index.json"), "utf8").then(JSON.parse).catch(() => ({ artists: [] })),
      readdir(path.join(ctx.generatedRoot, "album-details")).catch(() => []),
      run("git", ["status", "--short", "--branch"], { cwd: ctx.repositoryRoot, windowsHide: true }).then((value) => value.stdout.trim()).catch((error) => `UNAVAILABLE: ${error.message}`),
      Promise.resolve(process.version),
      run("ffprobe", ["-version"], { windowsHide: true }).then((value) => value.stdout.split(/\r?\n/u)[0]).catch((error) => `UNAVAILABLE: ${error.message}`),
      run("ffmpeg", ["-version"], { windowsHide: true }).then((value) => value.stdout.split(/\r?\n/u)[0]).catch((error) => `UNAVAILABLE: ${error.message}`),
    ]);
    const tracks = catalog.albums.reduce((sum, album) => sum + (album.tracks?.length ?? 0), 0);
    const batchEntries = await readdir(ctx.workspaceRoot, { withFileTypes: true }).catch(() => []);
    const journals = [];
    let activeBatchLocks = 0;
    for (const entry of batchEntries.filter((item) => item.isDirectory() && /^CONTENT-BATCH-/u.test(item.name))) {
      const root = path.join(ctx.workspaceRoot, entry.name);
      if (await exists(path.join(root, ".operator.lock"))) activeBatchLocks += 1;
      if (await exists(path.join(root, "transaction", "journal.json"))) {
        try { const manifest = await inspectTransaction(path.join(root, "transaction")); if (!["COMMITTED", "ROLLED_BACK", "ABORTED"].includes(manifest.state)) journals.push({ batchId: entry.name, state: manifest.state, transactionId: manifest.transactionId }); }
        catch (error) { journals.push({ batchId: entry.name, state: "AMBIGUOUS", error: error.message }); }
      }
    }
    const warnings = [];
    if (String(ffprobe).startsWith("UNAVAILABLE") || String(ffmpeg).startsWith("UNAVAILABLE")) warnings.push("DEPENDENCY_ENVIRONMENT_REQUIRES_ATTENTION");
    if (journals.length) warnings.push("RECOVERY_REQUIRED");
    return envelope(command, { status: warnings.length ? "DOCTOR_ATTENTION_REQUIRED" : "DOCTOR_COMPLETE", counts: { albums: catalog.albums.length, artists: artistIndex.artists.length, details: details.filter((name) => name.endsWith(".json")).length, tracks }, warnings, extra: { environment: { repositoryRoot: ctx.repositoryRoot, node, ffprobe, ffmpeg, git }, capabilities: { discovery: { available: true, networkProbePerformed: false, sources: ["current-artists", "public-new-albums"] } }, locks: { production: Boolean(await exists(path.join(ctx.workspaceRoot, ".production-writer.lock"))), batches: activeBatchLocks }, nonTerminalTransactions: journals, catalogSha256: await sha256File(ctx.catalogPath), networkRequests: 0 } });
  }
  if (command === "discover") return withLocks([{ file: path.join(ctx.workspaceRoot, "discovery", ".operator.lock"), options: { command } }], async () => {
    const result = await runDiscovery({ catalogPath: ctx.catalogPath, artistIndexPath: ctx.artistIndexPath, workspaceRoot: ctx.workspaceRoot, legacyCacheRoot: ctx.legacyDiscoveryCacheRoot, limit: options.limit === undefined ? Infinity : Number(options.limit), artistLimit: options["artist-limit"] === undefined ? Infinity : Number(options["artist-limit"]), types: options.types, fromCurrentArtists: options["from-current-artists"], refresh: options.refresh, concurrency: options.concurrency === undefined ? 2 : Number(options.concurrency) });
    const failed = result.status === "DISCOVERY_FAILED";
    return envelope(command, { status: result.status, counts: result.counts, fingerprints: { discovery: result.fingerprint, candidate: result.candidateFingerprint, baseline: result.productionBaseline.catalogFingerprint }, warnings: result.failures.map((failure) => `${failure.code}: ${failure.artistId ?? failure.source}`), artifacts: { candidate: result.paths.candidate, snapshot: result.paths.snapshot }, nextAction: failed ? "Inspect source failures; no candidate acquisition should start." : `acquire --input \"${result.paths.candidate}\"`, exitCategory: failed ? "acquisition" : "success", extra: { runId: result.runId, sources: result.sources.filter((source) => !source.skipped).map((source) => source.source), failedSources: result.failures.length, network: result.network, taxonomy: { coreGenres: "REQUIRED_BEFORE_QUALIFIED_CANDIDATE", inferred: false }, productionMutation: false } });
  });
  const batch = await resolveBatch(ctx, options, { allowInput: command === "acquire" || command === "dry-run" });
  if (command === "acquire") return withLocks(lockSet(ctx, batch, command), async () => { const report = await acquireBatch({ batchRoot: batch.root, refresh: options.refresh, concurrency: options.concurrency }); const blocked = report.failed > 0 || report.refreshDrift > 0 || report.sourceDefects > 0; return envelope(command, { status: report.sourceDefects ? "SOURCE_DEFECTS_DO_NOT_IMPORT" : blocked ? "ACQUISITION_INCOMPLETE" : "ACQUISITION_COMPLETE", batchId: batch.id, counts: report, artifacts: { report: path.join(batch.root, "acquisition", "report.json") }, nextAction: blocked ? `finalize-acquisition --batch ${batch.id}` : `dry-run --batch ${batch.id}`, exitCategory: blocked ? "acquisition" : "success" }); });
  if (command === "finalize-acquisition") return withLocks(lockSet(ctx, batch, command), async () => { const result = await finalizeAcquisition({ batchRoot: batch.root }); return envelope(command, { status: result.report.acquisitionUsable ? "ACQUISITION_USABLE" : "ACQUISITION_BLOCKED", batchId: batch.id, counts: result.report.counts, fingerprints: { finalization: result.report.fingerprint }, artifacts: result.paths, nextAction: result.report.acquisitionUsable ? `taxonomy --batch ${batch.id}` : "Resolve unresolved acquisition failures.", exitCategory: result.report.acquisitionUsable ? "success" : "acquisition", extra: { cleanReuse: result.report.cleanReuse, networkRequests: 0, productionMutation: false } }); });
  if (command === "taxonomy") return withLocks(lockSet(ctx, batch, command), async () => { const result = await buildTaxonomyProposal({ batchRoot: batch.root, catalogPath: ctx.catalogPath }); return envelope(command, { status: "TAXONOMY_REVIEW_REQUIRED", batchId: batch.id, counts: result.proposal.counts, fingerprints: { proposal: result.proposal.fingerprint, baseline: result.proposal.productionCatalogSha256 }, artifacts: result.paths, nextAction: `review --batch ${batch.id} --apply <taxonomy-decisions.json>`, exitCategory: "review", extra: { confidence: "PROPOSED_NOT_HUMAN_ACCEPTED", networkRequests: 0, productionMutation: false } }); });
  if (command === "dry-run") return withLocks(lockSet(ctx, batch, command), async () => { const config = JSON.parse(await readFile(path.join(batch.root, "batch.json"), "utf8")); const finalization = await readAcquisitionFinalization(batch.root); if (finalization && !config.operator?.activeInput) throw operatorError("TAXONOMY_REVIEW_INCOMPLETE", "Apply explicit decisions for every taxonomy group before dry-run.", "review"); const result = await runDryRun({ batchRoot: batch.root, catalogPath: ctx.catalogPath, identitiesPath: ctx.identitiesPath, rymSnapshotPath: ctx.rymSnapshotPath }); await snapshotQualification(ctx, batch, result); const blocked = result.report.counts.NEEDS_REVIEW > 0 || result.report.counts.ERROR > 0 || result.report.counts.FATAL > 0; return envelope(command, { status: blocked ? "QUALIFICATION_BLOCKED" : "DRY_RUN_COMPLETE", batchId: batch.id, counts: result.report.counts, fingerprints: { result: result.report.resultFingerprint, candidate: result.plan.candidate.fingerprint, baseline: result.plan.baseline.catalogFingerprint }, artifacts: { report: path.join(batch.root, "report", "report.md"), plan: path.join(batch.root, "plan", "plan.json"), qualification: path.join(batch.root, "operator", "qualification.json") }, exitCategory: result.report.counts.NEEDS_REVIEW ? "review" : blocked ? "preflight" : "success", nextAction: `status --batch ${batch.id}`, extra: { networkRequests: 0, productionMutation: false } }); });
  if (command === "status") { let qualification = null; let qualificationError = null; if (await exists(path.join(batch.root, "plan", "plan.json"))) { try { qualification = await readQualification(ctx, batch); } catch (error) { qualificationError = `${error.code ?? "QUALIFICATION_UNAVAILABLE"}: ${error.message}`; } } const [journal, finalization, taxonomy] = await Promise.all([journalState(batch), readAcquisitionFinalization(batch.root), readTaxonomyProposal(batch.root)]); const config = JSON.parse(await readFile(path.join(batch.root, "batch.json"), "utf8")); const pendingTaxonomy = taxonomy && !config.operator?.activeInput; const status = qualification ? qualification.promotable ? "PROMOTABLE" : "NOT_PROMOTABLE" : pendingTaxonomy ? "AWAITING_TAXONOMY_REVIEW" : finalization?.acquisitionUsable ? "ACQUISITION_USABLE" : "NOT_QUALIFIED"; return envelope(command, { status, batchId: batch.id, counts: qualification?.report.counts ?? finalization?.counts ?? {}, fingerprints: qualification ? { result: qualification.report.resultFingerprint, candidate: qualification.plan.candidate.fingerprint, baseline: qualification.plan.baseline.catalogFingerprint } : { finalization: finalization?.fingerprint, taxonomy: taxonomy?.fingerprint }, warnings: [...(qualification?.drift ?? []), ...(qualificationError ? [qualificationError] : [])], nextAction: pendingTaxonomy ? `review --batch ${batch.id} --apply <taxonomy-decisions.json>` : finalization?.acquisitionUsable && !qualification ? `taxonomy --batch ${batch.id}` : null, extra: { acquisitionUsable: finalization?.acquisitionUsable ?? null, taxonomy: taxonomy?.counts ?? null, journalState: journal?.state ?? null, transactionId: journal?.transactionId ?? null, networkRequests: 0 } }); }
  if (command === "review") return withLocks(lockSet(ctx, batch, command), async () => {
    const file = path.join(batch.root, "review", "review-decisions.json");
    await mkdir(path.dirname(file), { recursive: true });
    if (options.apply) {
      const supplied = JSON.parse(await readFile(path.resolve(options.apply), "utf8"));
      if (supplied.schema === TAXONOMY_DECISIONS_SCHEMA) { const applied = await applyTaxonomyDecisions({ batchRoot: batch.root, catalogPath: ctx.catalogPath, artifact: supplied }); return envelope(command, { status: applied.decisions.unresolvedGroups ? "TAXONOMY_REVIEW_PARTIAL" : "TAXONOMY_REVIEW_APPLIED", batchId: batch.id, counts: { acceptedGroups: applied.decisions.decisions.length, unresolvedGroups: applied.decisions.unresolvedGroups }, fingerprints: { taxonomyReview: applied.decisions.fingerprint }, artifacts: applied.paths, nextAction: applied.decisions.unresolvedGroups ? `review --batch ${batch.id} --apply <additional-decisions.json>` : `dry-run --batch ${batch.id}`, exitCategory: applied.decisions.unresolvedGroups ? "review" : "success" }); }
    }
    const qualification = await readQualification(ctx, batch);
    if (!options.apply) { const template = reviewTemplate({ batchId: batch.id, inputSha256: qualification.inputSha256, records: qualification.report.records }); await writeFile(path.join(batch.root, "review", "review-template.json"), stableJson(template), "utf8"); return envelope(command, { status: "REVIEW_EXPORTED", batchId: batch.id, counts: { reviewDecisions: template.decisions.length, quarantineDecisions: template.quarantines.length }, artifacts: { template: path.join(batch.root, "review", "review-template.json") }, exitCategory: template.decisions.length || template.quarantines.length ? "review" : "success", extra: { networkRequests: 0, productionMutation: false } }); }
    const supplied = JSON.parse(await readFile(path.resolve(options.apply), "utf8"));
    const validated = validateReviewDecisionArtifact(supplied, { batchId: batch.id, inputSha256: qualification.inputSha256, albumIds: qualification.report.records.map((record) => record.albumId) });
    await writeFile(file, stableJson({ schema: validated.schema, batchId: validated.batchId, inputSha256: validated.inputSha256, decisions: validated.decisions, quarantines: validated.quarantines }), "utf8");
    return envelope(command, { status: "REVIEW_APPLIED_QUALIFICATION_INVALIDATED", batchId: batch.id, counts: { accepted: validated.decisions.filter((item) => item.decision === "ACCEPT").length, rejected: validated.decisions.filter((item) => item.decision === "REJECT").length, quarantined: validated.quarantines.length }, fingerprints: { review: validated.fingerprint }, nextAction: `dry-run --batch ${batch.id}` });
  });
  if (command === "prepare") return withLocks(lockSet(ctx, batch, command, true), async () => {
    const q = await readQualification(ctx, batch); if (!q.promotable) throw operatorError("NOT_PROMOTABLE", q.drift.join(", ") || "Qualification has blocking findings.", "preflight");
    if (await journalState(batch)) throw operatorError("TRANSACTION_ALREADY_EXISTS", "Inspect or recover the existing journal.", "transaction");
    const operations = [{ staged: path.join(batch.root, "candidate", "generated"), destination: ctx.generatedRoot }];
    for (const id of q.plan.readyAlbumIds) for (const kind of ["thumb", "detail"]) operations.push({ staged: path.join(batch.root, "candidate", "assets", "covers", kind, `${id}.webp`), destination: path.join(ctx.coverRoot, kind, `${id}.webp`) });
    const manifest = await prepareTransaction({ batchId: batch.id, baselineCatalogFingerprint: q.plan.baseline.catalogFingerprint, candidateFingerprint: q.plan.candidate.fingerprint, resultFingerprint: q.report.resultFingerprint, batchRoot: batch.root, transactionRoot: path.join(batch.root, "transaction"), operations, allowedDestinationRoots: [ctx.generatedRoot, ctx.coverRoot] });
    return envelope(command, { status: "PREPARED", batchId: batch.id, fingerprints: { candidate: manifest.candidateFingerprint, result: manifest.resultFingerprint, productionBefore: manifest.productionBeforeFingerprint, intendedAfter: manifest.intendedAfterFingerprint }, artifacts: { journal: path.join(batch.root, "transaction", "journal.json") }, extra: { transactionId: manifest.transactionId, operations: manifest.operations.length }, nextAction: "Obtain explicit human authorization before promote." });
  });
  if (command === "promote") {
    if (!options.transaction || !options["candidate-fingerprint"]) throw operatorError("PROMOTE_AUTHORIZATION_REQUIRED", "--transaction and --candidate-fingerprint are mandatory.", "authorization");
    return withLocks(lockSet(ctx, batch, command, true), async () => { const qualification = await readQualification(ctx, batch); if (!qualification.promotable) throw operatorError("QUALIFICATION_DRIFT", qualification.drift.join(", ") || "Candidate is no longer promotable.", "preflight"); const root = path.join(batch.root, "transaction"); const before = await inspectTransaction(root); if (before.transactionId !== options.transaction || before.candidateFingerprint !== options["candidate-fingerprint"] || qualification.plan.candidate.fingerprint !== options["candidate-fingerprint"]) throw operatorError("AUTHORIZATION_MISMATCH", "Transaction or candidate fingerprint mismatch.", "authorization"); const result = await promoteTransaction({ manifest: before, transactionRoot: root }); return envelope(command, { status: result.state, batchId: batch.id, fingerprints: { candidate: result.candidateFingerprint }, extra: { transactionId: result.transactionId }, nextAction: `status --batch ${batch.id}` }); });
  }
  if (command === "recover") return withLocks(lockSet(ctx, batch, command, true), async () => { const root = path.join(batch.root, "transaction"); const current = await inspectTransaction(root); const result = await recoverTransaction({ transactionRoot: root, expectedBatchId: batch.id, expectedCandidateFingerprint: current.candidateFingerprint, expectedResultFingerprint: current.resultFingerprint, allowedDestinationRoots: [ctx.generatedRoot, ctx.coverRoot] }); return envelope(command, { status: result.manifest.state, batchId: batch.id, extra: { action: result.action, transactionId: result.manifest.transactionId } }); });
  throw operatorError("UNREACHABLE", command, "internal");
}

function human(result) {
  const lines = [`${result.command}: ${result.status}`];
  if (result.batchId) lines.push(`Batch: ${result.batchId}`);
  if (result.message) lines.push(result.message);
  if (Object.keys(result.counts).length) lines.push(`Counts: ${JSON.stringify(result.counts)}`);
  if (Object.keys(result.fingerprints).length) lines.push(`Fingerprints: ${JSON.stringify(result.fingerprints)}`);
  if (result.nextAction) lines.push(`Next: ${result.nextAction}`);
  return lines.join("\n");
}

export async function runOperator(argv, { stdout = process.stdout, stderr = process.stderr, environment = process.env } = {}) {
  let options;
  try { options = parseOperatorArguments(argv); validateCommandOptions(options); const result = await execute(options, contextFromEnvironment(environment)); const exitCode = EXIT[result.exitCategory] ?? EXIT.internal; stdout.write(options.json ? `${JSON.stringify(result)}\n` : `${human(result)}\n`); return exitCode; }
  catch (error) { const exitCategory = error.exitCategory ?? ({ ACQUISITION_TIMEOUT: "acquisition", ACQUISITION_HTTP_ERROR: "acquisition", LOCK_ACTIVE: "preflight", RECOVERY_REQUIRED: "transaction" }[error.code] ?? (String(error.code ?? "").startsWith("DISCOVERY_") ? "acquisition" : "internal")); const result = envelope(options?.command ?? String(argv[0] ?? "help"), { status: "FAILED", exitCategory, message: String(error.message), errors: [{ code: error.code ?? "UNEXPECTED_ERROR", message: String(error.message) }] }); if (options?.json || argv.includes("--json")) stdout.write(`${JSON.stringify(result)}\n`); else stderr.write(`${human(result)}\n`); return EXIT[exitCategory] ?? EXIT.internal; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await runOperator(process.argv.slice(2));

export { EXIT, RESULT_SCHEMA, execute };
