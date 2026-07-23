import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveRymTaxonomy, validateRymTaxonomySnapshot } from "./rym-taxonomy.mjs";

export const RYM_MATCH_STATUSES = new Set([
  "MATCHED",
  "NOT_FOUND",
  "AMBIGUOUS",
  "REJECTED",
  "UNVERIFIED_NO_DATA",
]);
const RYM_IMPORTABLE_FIELDS = new Set([
  "rymRating",
  "rymRatingCount",
  "rymReference",
  "rymObservedAt",
  "primaryGenres",
  "secondaryGenres",
]);

export function validateRymDatasetEnvelope(input) {
  const errors = [];
  if (input?.version !== 2) errors.push("RYM enrichment input version must be 2.");
  if (!input?.dataset || typeof input.dataset !== "object") errors.push("dataset metadata is required.");
  for (const key of ["name", "source", "acquiredAt", "licenseBasis"]) {
    if (typeof input?.dataset?.[key] !== "string" || !input.dataset[key].trim()) errors.push(`dataset.${key} is required.`);
  }
  if (!Array.isArray(input?.dataset?.importedFields) || !input.dataset.importedFields.length) errors.push("dataset.importedFields is required.");
  else for (const field of input.dataset.importedFields) {
    if (!RYM_IMPORTABLE_FIELDS.has(field)) errors.push(`dataset.importedFields contains unsupported field ${field}.`);
  }
  if (!Array.isArray(input?.records)) errors.push("records must be an array.");
  for (const [index, record] of (input?.records ?? []).entries()) {
    if (!RYM_MATCH_STATUSES.has(record?.matchStatus)) errors.push(`records[${index}].matchStatus is invalid.`);
    if (Array.isArray(record?.descriptors) && record.descriptors.length) errors.push(`records[${index}].descriptors is unsupported in the current product contract.`);
    if (record?.matchStatus !== "MATCHED" && ["rymRating", "rymRatingCount", "rymObservedAt", "sourceReference", "primaryGenres", "secondaryGenres", "descriptors"].some((key) => {
      const value = record?.[key];
      return value != null && (!Array.isArray(value) || value.length > 0);
    })) errors.push(`records[${index}] cannot publish RYM fields unless matchStatus is MATCHED.`);
  }
  return errors;
}

export function enrichCatalogWithRym(catalog, input, importedAt = new Date().toISOString()) {
  const envelopeErrors = validateRymDatasetEnvelope(input);
  if (envelopeErrors.length) return { ok: false, errors: envelopeErrors };
  const matchedRecords = input.records.filter((record) => record.matchStatus === "MATCHED");
  const snapshot = {
    version: 2,
    sourceDescription: `${input.dataset.name}: ${input.dataset.source}`,
    importedAt: matchedRecords.length ? importedAt : null,
    records: matchedRecords,
  };
  const snapshotErrors = validateRymTaxonomySnapshot(snapshot);
  if (snapshotErrors.length) return { ok: false, errors: snapshotErrors };
  const statuses = new Map(input.records.map((record) => [String(record.neteaseAlbumId ?? ""), record.matchStatus]));
  let matched = 0;
  const albums = catalog.albums.map((album) => {
    const resolved = resolveRymTaxonomy(album, album.coreGenres, snapshot.records);
    if (resolved.rym.rymMatchStatus === "MATCHED") matched += 1;
    const explicitStatus = statuses.get(album.neteaseAlbumId);
    const rym = resolved.rym.rymMatchStatus === "MATCHED"
      ? resolved.rym
      : {
          ...resolved.rym,
          rymMatchStatus: explicitStatus && explicitStatus !== "MATCHED" && RYM_MATCH_STATUSES.has(explicitStatus)
            ? explicitStatus
            : "UNVERIFIED_NO_DATA",
        };
    return { ...album, ...resolved.taxonomy, ...rym };
  });
  return {
    ok: true,
    catalog: { ...catalog, albums },
    snapshot,
    summary: {
      inputRecords: input.records.length,
      matched,
      unmatched: catalog.albums.length - matched,
    },
  };
}

export async function sha256File(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
