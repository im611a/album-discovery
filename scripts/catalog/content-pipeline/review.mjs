import { readFile } from "node:fs/promises";
import { finding, SEVERITY } from "./contracts.mjs";
import { fingerprint } from "./utils.mjs";

export const REVIEW_SCHEMA = "content-pipeline-v1/review-decisions/v1";

export const REVIEWABLE_FINDING_CODES = Object.freeze(new Set([
  "TITLE_ASSERTION_MISMATCH",
  "ARTIST_ASSERTION_MISMATCH",
  "ARTIST_ID_NAME_CONFLICT",
  "AMBIGUOUS_ARTIST",
  "LIKELY_DUPLICATE",
  "POSSIBLE_EDITION",
  "CANDIDATE_IDENTITY_CONFLICT",
  "SLUG_OVERRIDE_REVIEW_REQUIRED",
  "REFRESH_REVIEW_REQUIRED",
]));

export const QUARANTINABLE_FINDING_CODES = Object.freeze(new Set([
  "invalid_track_list",
]));

function reviewError(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

export function validateReviewDecisionArtifact(value, { batchId, inputSha256, albumIds = null } = {}) {
  if (!value || value.schema !== REVIEW_SCHEMA) throw reviewError("INVALID_REVIEW_SCHEMA", `Expected ${REVIEW_SCHEMA}.`);
  if (value.batchId !== batchId) throw reviewError("REVIEW_BATCH_MISMATCH", "Review decisions belong to another batch.");
  if (value.inputSha256 !== inputSha256) throw reviewError("REVIEW_INPUT_DRIFT", "Review decisions do not match the current input fingerprint.");
  if (!Array.isArray(value.decisions)) throw reviewError("INVALID_REVIEW_DECISIONS", "decisions must be an array.");
  const known = albumIds ? new Set(albumIds.map(String)) : null;
  const seen = new Set();
  const decisions = value.decisions.map((decision) => {
    const albumId = String(decision?.albumId ?? "");
    const code = String(decision?.code ?? "");
    const action = String(decision?.decision ?? "");
    if (!/^\d+$/u.test(albumId) || (known && !known.has(albumId))) throw reviewError("FOREIGN_REVIEW_ALBUM", `Album ${albumId || "(missing)"} does not belong to this batch.`);
    if (!REVIEWABLE_FINDING_CODES.has(code)) throw reviewError("REVIEW_CODE_NOT_ALLOWED", `Finding ${code || "(missing)"} cannot be overridden by review.`);
    if (action === "PENDING") throw reviewError("REVIEW_DECISION_PENDING", `Decision for ${albumId}/${code} is still PENDING.`);
    if (!["ACCEPT", "REJECT"].includes(action)) throw reviewError("REVIEW_DECISION_INVALID", `Decision for ${albumId}/${code} must be ACCEPT or REJECT.`);
    const key = `${albumId}:${code}`;
    if (seen.has(key)) throw reviewError("DUPLICATE_REVIEW_DECISION", `Duplicate decision for ${key}.`);
    seen.add(key);
    return { albumId, code, decision: action };
  }).sort((left, right) => left.albumId.localeCompare(right.albumId, "en-US", { numeric: true }) || left.code.localeCompare(right.code));
  const quarantineSeen = new Set();
  const quarantines = (value.quarantines ?? []).map((decision) => {
    const albumId = String(decision?.albumId ?? "");
    const code = String(decision?.code ?? "");
    const action = String(decision?.decision ?? "");
    if (!/^\d+$/u.test(albumId) || (known && !known.has(albumId))) throw reviewError("FOREIGN_QUARANTINE_ALBUM", `Album ${albumId || "(missing)"} does not belong to this batch.`);
    if (!QUARANTINABLE_FINDING_CODES.has(code)) throw reviewError("QUARANTINE_CODE_NOT_ALLOWED", `Finding ${code || "(missing)"} is not an explicitly quarantinable deterministic source error.`);
    if (action === "PENDING") throw reviewError("QUARANTINE_DECISION_PENDING", `Quarantine decision for ${albumId}/${code} is still PENDING.`);
    if (action !== "QUARANTINE") throw reviewError("QUARANTINE_DECISION_INVALID", `Decision for ${albumId}/${code} must be explicit QUARANTINE.`);
    const key = `${albumId}:${code}`;
    if (quarantineSeen.has(key)) throw reviewError("DUPLICATE_QUARANTINE_DECISION", `Duplicate quarantine decision for ${key}.`);
    quarantineSeen.add(key);
    return { albumId, code, decision: action };
  }).sort((left, right) => left.albumId.localeCompare(right.albumId, "en-US", { numeric: true }) || left.code.localeCompare(right.code));
  const rowActions = new Map();
  for (const item of decisions) rowActions.set(item.albumId, new Set([...(rowActions.get(item.albumId) ?? []), item.decision]));
  for (const item of quarantines) rowActions.set(item.albumId, new Set([...(rowActions.get(item.albumId) ?? []), item.decision]));
  const conflictingRows = [...rowActions].filter(([, actions]) => actions.has("REJECT") && actions.has("QUARANTINE")).map(([albumId]) => albumId);
  if (conflictingRows.length) throw reviewError("CONFLICTING_ROW_EXCLUSION_DECISION", `Rows cannot be both REJECTED and QUARANTINED: ${conflictingRows.join(", ")}`);
  return {
    schema: REVIEW_SCHEMA,
    batchId,
    inputSha256,
    decisions,
    quarantines,
    fingerprint: fingerprint({ schema: REVIEW_SCHEMA, batchId, inputSha256, decisions, quarantines }),
  };
}

export async function loadReviewDecisions(file, context) {
  try {
    return validateReviewDecisionArtifact(JSON.parse(await readFile(file, "utf8")), context);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function applyReviewDecisions(findings, albumId, overlay) {
  if (!overlay) return { findings, applied: [], rejected: false, quarantined: false };
  const decisions = new Map(overlay.decisions.filter((decision) => decision.albumId === String(albumId)).map((decision) => [decision.code, decision]));
  const quarantines = new Map(overlay.quarantines.filter((decision) => decision.albumId === String(albumId)).map((decision) => [decision.code, decision]));
  const applied = [];
  let rejected = false;
  let quarantined = false;
  const resolved = findings.map((item) => {
    const decision = decisions.get(item.code);
    if (decision && item.level === SEVERITY.NEEDS_REVIEW) {
      applied.push(`${decision.albumId}:${decision.code}`);
      if (decision.decision === "REJECT") rejected = true;
      return finding(SEVERITY.PASS, decision.decision === "REJECT" ? "HUMAN_REVIEW_REJECTED" : "HUMAN_REVIEW_ACCEPTED", `Human review ${decision.decision === "REJECT" ? "rejected" : "accepted"} ${item.code} for Album ${albumId}.`, null, {
        reviewedFindingCode: item.code,
        reviewedDecision: decision.decision,
        originalFinding: item,
      });
    }
    const quarantine = quarantines.get(item.code);
    if (quarantine && item.level === SEVERITY.ERROR) {
      applied.push(`${quarantine.albumId}:${quarantine.code}`);
      quarantined = true;
      return finding(SEVERITY.PASS, "QUARANTINED_INVALID_SOURCE_DATA", `Album ${albumId} was explicitly quarantined for deterministic invalid source data.`, null, {
        quarantinedFindingCode: item.code,
        quarantineDecision: quarantine.decision,
        originalFinding: item,
      });
    }
    return item;
  });
  return { findings: resolved, applied, rejected, quarantined };
}

export function reviewTemplate({ batchId, inputSha256, records }) {
  return {
    schema: REVIEW_SCHEMA,
    batchId,
    inputSha256,
    instructions: "Set every review decision to ACCEPT or REJECT. Only the separately listed deterministic quarantine entries may be set to QUARANTINE; unknown ERROR, FATAL, and acquisition source defects cannot be overridden.",
    decisions: records.flatMap((record) => record.findings
      .filter((item) => item.level === SEVERITY.NEEDS_REVIEW && REVIEWABLE_FINDING_CODES.has(item.code))
      .map((item) => ({ albumId: record.albumId, code: item.code, decision: "PENDING" }))),
    quarantines: records.flatMap((record) => record.findings
      .filter((item) => item.level === SEVERITY.ERROR && QUARANTINABLE_FINDING_CODES.has(item.code))
      .map((item) => ({ albumId: record.albumId, code: item.code, decision: "PENDING" }))),
  };
}
