export const PIPELINE_VERSION = "content-pipeline-v1";

export const SEVERITY = Object.freeze({
  PASS: "PASS",
  WARNING: "WARNING",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  ERROR: "ERROR",
  FATAL: "FATAL",
});

export const DISPOSITION = Object.freeze({
  READY: "READY",
  SKIPPED_DUPLICATE: "SKIPPED_DUPLICATE",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  ERROR: "ERROR",
  FATAL: "FATAL",
  IMPORTED: "IMPORTED",
});

export const ARTIST_STATE = Object.freeze({
  RESOLVED_EXISTING_ARTIST: "RESOLVED_EXISTING_ARTIST",
  CREATE_NEW_ARTIST: "CREATE_NEW_ARTIST",
  ARTIST_ID_NAME_CONFLICT: "ARTIST_ID_NAME_CONFLICT",
  AMBIGUOUS_ARTIST: "AMBIGUOUS_ARTIST",
  UNKNOWN_ARTIST: "UNKNOWN_ARTIST",
  INVALID_ARTIST_ID: "INVALID_ARTIST_ID",
  DUPLICATE_ARTIST_ID_CONFLICT: "DUPLICATE_ARTIST_ID_CONFLICT",
  KNOWN_FROZEN_ARTIST_ID_0_DEBT: "KNOWN_FROZEN_ARTIST_ID_0_DEBT",
});

export const DUPLICATE_STATE = Object.freeze({
  EXACT_DUPLICATE: "EXACT_DUPLICATE",
  LIKELY_DUPLICATE: "LIKELY_DUPLICATE",
  POSSIBLE_EDITION: "POSSIBLE_EDITION",
  DISTINCT: "DISTINCT",
});

export function finding(level, code, message, nextAction = null, details = {}) {
  return { level, code, message, nextAction, ...details };
}

export function dispositionFromFindings(findings, duplicateState) {
  if (findings.some((item) => item.level === SEVERITY.FATAL)) return DISPOSITION.FATAL;
  if (findings.some((item) => item.level === SEVERITY.ERROR)) return DISPOSITION.ERROR;
  if (findings.some((item) => item.level === SEVERITY.NEEDS_REVIEW)) return DISPOSITION.NEEDS_REVIEW;
  if (duplicateState === DUPLICATE_STATE.EXACT_DUPLICATE) return DISPOSITION.SKIPPED_DUPLICATE;
  return DISPOSITION.READY;
}
