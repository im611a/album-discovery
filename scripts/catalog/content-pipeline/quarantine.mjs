import path from "node:path";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { readBatchInput } from "./input.mjs";
import { fingerprint, sha256File, stableJson } from "./utils.mjs";

export const ACQUISITION_FINALIZATION_SCHEMA = "content-pipeline-v1/acquisition-finalization/v1";
export const CLEAN_INPUT_SCHEMA = "content-pipeline-v1/clean-acquisition-input/v1";

function quarantineError(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

async function existingCover(batchRoot, albumId) {
  const root = path.join(batchRoot, "incoming-covers");
  const matches = (await readdir(root)).filter((name) => name.startsWith(`${albumId}.`));
  if (matches.length !== 1) throw quarantineError("CLEAN_COVER_COUNT_INVALID", `${albumId} has ${matches.length} source covers.`);
  return path.join(root, matches[0]);
}

function cleanRecord(row) {
  return {
    album_id: row.albumId,
    contexts: row.contexts.join("|"),
    core_genres: row.coreGenres.join("|"),
    discovered_at: row.discoveredAt ?? "",
    expected_artists: row.expectedArtists.join("|"),
    expected_title: row.expectedTitle,
    manual_verified: row.manualVerified ? "true" : "false",
    refresh: row.refresh ? "true" : "false",
    source_reference: row.sourceReference ?? "",
    cover_file: row.coverFile ?? "",
    slug_override: row.slugOverride ?? "",
  };
}

export async function readAcquisitionFinalization(batchRoot) {
  const file = path.join(batchRoot, "acquisition", "finalized", "report.json");
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

export async function finalizeAcquisition({ batchRoot }) {
  const configFile = path.join(batchRoot, "batch.json");
  const reportFile = path.join(batchRoot, "acquisition", "report.json");
  const [config, report] = await Promise.all([readFile(configFile, "utf8").then(JSON.parse), readFile(reportFile, "utf8").then(JSON.parse)]);
  if (report.schema !== "content-pipeline-v1/acquisition/v1" || report.batchId !== config.id) throw quarantineError("ACQUISITION_REPORT_IDENTITY_MISMATCH", config.id);
  const inputFile = path.join(batchRoot, config.input);
  const rows = await readBatchInput(inputFile);
  if (report.requested !== rows.length || report.results?.length !== rows.length) throw quarantineError("ACQUISITION_ACCOUNTING_MISMATCH", `${rows.length}/${report.requested}/${report.results?.length ?? 0}`);
  const rowById = new Map(rows.map((row) => [row.albumId, row]));
  const seen = new Set();
  const records = [];
  for (const result of report.results) {
    const albumId = String(result.albumId ?? "");
    if (!rowById.has(albumId) || seen.has(albumId)) throw quarantineError("ACQUISITION_RESULT_IDENTITY_MISMATCH", albumId);
    seen.add(albumId);
    const doNotImport = (result.defects ?? []).find((defect) => defect.disposition === "DO_NOT_IMPORT");
    let classification = "CLEAN";
    let disposition = "CONTINUE";
    if (doNotImport) { classification = "DO_NOT_IMPORT"; disposition = "DO_NOT_IMPORT"; }
    else if (result.status === "FAILED" && result.code === "ACQUISITION_HTTP_ERROR") { classification = "SOURCE_UNAVAILABLE"; disposition = "RETRYABLE_OR_QUARANTINED"; }
    else if (!["ACQUIRED", "REFRESHED", "CACHE_HIT"].includes(result.status)) { classification = "UNRESOLVED_FAILURE"; disposition = "BLOCKING"; }
    const evidence = { payload: null, cover: null, rawResponse: result.rawResponse ?? null };
    if (classification === "CLEAN") {
      const payloadFile = path.join(batchRoot, "input", "payloads", `${albumId}.json`);
      const coverFile = await existingCover(batchRoot, albumId);
      const [payloadInfo, coverInfo, payloadSha256, coverSha256] = await Promise.all([stat(payloadFile), stat(coverFile), sha256File(payloadFile), sha256File(coverFile)]);
      if (result.payloadSha256 && result.payloadSha256 !== payloadSha256) throw quarantineError("CLEAN_PAYLOAD_DRIFT", albumId);
      if (result.cover?.sha256 && result.cover.sha256 !== coverSha256) throw quarantineError("CLEAN_COVER_DRIFT", albumId);
      evidence.payload = { file: path.relative(batchRoot, payloadFile).replaceAll("\\", "/"), sha256: payloadSha256, bytes: payloadInfo.size };
      evidence.cover = { file: path.relative(batchRoot, coverFile).replaceAll("\\", "/"), sha256: coverSha256, bytes: coverInfo.size };
    }
    records.push({ albumId, classification, originalStatus: result.status, defectCode: doNotImport?.code ?? result.code ?? null, disposition, reason: doNotImport ? `${doNotImport.code}: ${(doNotImport.positions ?? []).join(",")}` : result.message ?? null, evidence });
  }
  if (seen.size !== rows.length) throw quarantineError("ACQUISITION_ACCOUNTING_INCOMPLETE", `${seen.size}/${rows.length}`);
  records.sort((left, right) => left.albumId.localeCompare(right.albumId, "en-US", { numeric: true }));
  const counts = {
    requested: records.length,
    clean: records.filter((item) => item.classification === "CLEAN").length,
    doNotImport: records.filter((item) => item.classification === "DO_NOT_IMPORT").length,
    unavailable: records.filter((item) => item.classification === "SOURCE_UNAVAILABLE").length,
    unresolvedBlocking: records.filter((item) => item.classification === "UNRESOLVED_FAILURE").length,
  };
  const cleanIds = new Set(records.filter((item) => item.classification === "CLEAN").map((item) => item.albumId));
  const cleanRows = rows.filter((row) => cleanIds.has(row.albumId)).map(cleanRecord);
  const cleanInput = { schema: CLEAN_INPUT_SCHEMA, batchId: config.id, sourceInputSha256: await sha256File(inputFile), records: cleanRows };
  cleanInput.fingerprint = fingerprint(cleanInput);
  const finalized = {
    schema: ACQUISITION_FINALIZATION_SCHEMA,
    batchId: config.id,
    sourceReportSha256: await sha256File(reportFile),
    sourceInputSha256: cleanInput.sourceInputSha256,
    counts,
    acquisitionUsable: counts.unresolvedBlocking === 0 && counts.clean > 0,
    cleanReuse: { payloads: counts.clean, covers: counts.clean, copiedArtifacts: 0, acquisitionRequests: 0, networkRequests: 0 },
    cleanInput: { path: "acquisition/finalized/clean-input.json", fingerprint: cleanInput.fingerprint },
    records,
  };
  finalized.fingerprint = fingerprint(finalized);
  const root = path.join(batchRoot, "acquisition", "finalized");
  await mkdir(root, { recursive: true });
  await Promise.all([writeFile(path.join(root, "clean-input.json"), stableJson(cleanInput), "utf8"), writeFile(path.join(root, "report.json"), stableJson(finalized), "utf8")]);
  return { report: finalized, paths: { report: path.join(root, "report.json"), cleanInput: path.join(root, "clean-input.json") } };
}
