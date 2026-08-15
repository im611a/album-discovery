import { readStructuredRows } from "../structured-input.mjs";
import { finding, SEVERITY } from "./contracts.mjs";

const trueValues = new Set(["true", "1", "yes"]);

const splitList = (value) => [...new Set(String(value ?? "").split("|").map((item) => item.trim()).filter(Boolean))];

export function normalizeInputRow(raw, rowNumber) {
  const albumId = String(raw.album_id ?? "").trim().replace(/^0+(?=\d)/, "");
  const expectedTitle = String(raw.expected_title ?? "").trim();
  const expectedArtists = splitList(raw.expected_artists);
  const findings = [];
  if (!/^\d+$/.test(albumId) || BigInt(albumId || "0") <= 0n) {
    findings.push(finding(SEVERITY.ERROR, "INVALID_ALBUM_ID", "album_id must be a positive decimal NetEase album ID.", "Correct album_id."));
  }
  if (!expectedTitle) findings.push(finding(SEVERITY.ERROR, "MISSING_EXPECTED_TITLE", "expected_title is required.", "Add the expected Album title."));
  if (!expectedArtists.length) findings.push(finding(SEVERITY.ERROR, "MISSING_EXPECTED_ARTISTS", "expected_artists is required.", "Add pipe-separated expected Artist names."));
  const coreGenres = splitList(raw.core_genres);
  if (!coreGenres.length) findings.push(finding(SEVERITY.ERROR, "MISSING_CORE_GENRES", "core_genres requires at least one reviewed key.", "Add reviewed core genre keys."));
  const discoveredAt = String(raw.discovered_at ?? "").trim() || null;
  if (discoveredAt && !Number.isFinite(new Date(discoveredAt).getTime())) {
    findings.push(finding(SEVERITY.ERROR, "INVALID_DISCOVERED_AT", "discovered_at must be an ISO-compatible timestamp.", "Correct or omit discovered_at."));
  }
  const refreshRaw = String(raw.refresh ?? "").trim().toLocaleLowerCase("en-US");
  if (refreshRaw && !trueValues.has(refreshRaw) && !["false", "0", "no"].includes(refreshRaw)) {
    findings.push(finding(SEVERITY.ERROR, "INVALID_REFRESH", "refresh must be a boolean value.", "Use true or false."));
  }
  return {
    rowNumber,
    albumId,
    expectedTitle,
    expectedArtists,
    coreGenres,
    contexts: splitList(raw.contexts),
    coverFile: String(raw.cover_file ?? "").trim() || null,
    sourceReference: String(raw.source_reference ?? "").trim() || null,
    discoveredAt,
    slugOverride: String(raw.slug_override ?? "").trim() || null,
    refresh: trueValues.has(refreshRaw),
    findings,
  };
}

export async function readBatchInput(file) {
  const rows = [];
  let rowNumber = 1;
  for await (const raw of readStructuredRows(file)) {
    rowNumber += 1;
    rows.push(normalizeInputRow(raw, rowNumber));
  }
  return rows;
}
