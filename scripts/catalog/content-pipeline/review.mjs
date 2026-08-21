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
  "SLUG_OVERRIDE_REVIEW_REQUIRED",
  "REFRESH_REVIEW_REQUIRED",
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
    if (action !== "ACCEPT") throw reviewError("REVIEW_DECISION_NOT_ACCEPTED", `Decision for ${albumId}/${code} must be explicit ACCEPT.`);
    const key = `${albumId}:${code}`;
    if (seen.has(key)) throw reviewError("DUPLICATE_REVIEW_DECISION", `Duplicate decision for ${key}.`);
    seen.add(key);
    return { albumId, code, decision: action };
  }).sort((left, right) => left.albumId.localeCompare(right.albumId, "en-US", { numeric: true }) || left.code.localeCompare(right.code));
  return {
    schema: REVIEW_SCHEMA,
    batchId,
    inputSha256,
    decisions,
    fingerprint: fingerprint({ schema: REVIEW_SCHEMA, batchId, inputSha256, decisions }),
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
  if (!overlay) return { findings, applied: [] };
  const decisions = new Map(overlay.decisions.filter((decision) => decision.albumId === String(albumId)).map((decision) => [decision.code, decision]));
  const applied = [];
  const resolved = findings.map((item) => {
    const decision = decisions.get(item.code);
    if (!decision || item.level !== SEVERITY.NEEDS_REVIEW) return item;
    applied.push(`${decision.albumId}:${decision.code}`);
    return finding(SEVERITY.PASS, "HUMAN_REVIEW_ACCEPTED", `Human review accepted ${item.code} for Album ${albumId}.`, null, {
      reviewedFindingCode: item.code,
      reviewedDecision: decision.decision,
      originalMessage: item.message,
    });
  });
  return { findings: resolved, applied };
}

export function reviewTemplate({ batchId, inputSha256, records }) {
  return {
    schema: REVIEW_SCHEMA,
    batchId,
    inputSha256,
    instructions: "Replace PENDING only after human review. ERROR/FATAL/source defects cannot be overridden.",
    decisions: records.flatMap((record) => record.findings
      .filter((item) => item.level === SEVERITY.NEEDS_REVIEW && REVIEWABLE_FINDING_CODES.has(item.code))
      .map((item) => ({ albumId: record.albumId, code: item.code, decision: "PENDING" }))),
  };
}
