import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { normalizeRymInputRow, readRymInputRows } from "./rym-input.mjs";
import { isMatchedRymStatus, matchAlbumToRym, normalizeIdentityText, stableGenreKey } from "./rym-matcher.mjs";

export const RYM_MATCH_STATUSES = new Set([
  "MATCHED_EXACT",
  "MATCHED_ALIAS",
  "MATCHED_STRONG",
  "NOT_FOUND",
  "AMBIGUOUS",
  "REJECTED",
  "UNVERIFIED_NO_DATA",
]);

const terms = (values) => [...new Set(values)].map((labelEn) => ({
  key: stableGenreKey(labelEn),
  labelZh: null,
  labelEn,
})).filter((term) => term.key && term.labelEn);

export async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function collectRelevantRymRows(file, catalog, inputSourceId, onProgress = () => {}) {
  const titleKeys = new Set(catalog.albums.flatMap((album) => [album.title, ...album.aliases]).map(normalizeIdentityText));
  const rows = [];
  let read = 0;
  let rejectedInputRows = 0;
  for await (const raw of readRymInputRows(file)) {
    read += 1;
    const row = normalizeRymInputRow(raw, read, inputSourceId);
    if (!row.title || !row.artist || !row.releaseYear) {
      rejectedInputRows += 1;
    } else if (titleKeys.has(normalizeIdentityText(row.title))) {
      rows.push(row);
    }
    if (read % 10_000 === 0) onProgress({ read, relevant: rows.length, rejectedInputRows });
  }
  return { read, rows, rejectedInputRows };
}

function validateMatchedCandidate(candidate) {
  const errors = [];
  if (candidate.rating != null && (!Number.isFinite(candidate.rating) || candidate.rating <= 0 || candidate.rating > 5)) {
    errors.push("invalid_rating");
  }
  if (candidate.ratingCount != null && (!Number.isInteger(candidate.ratingCount) || candidate.ratingCount < 0)) {
    errors.push("invalid_rating_count");
  }
  if (candidate.rating == null && candidate.ratingCount != null) errors.push("rating_count_without_rating");
  return errors;
}

export function buildRymEnrichment(catalog, relevantRows, {
  inputSourceId,
  inputSha256,
  observedAt,
  limit = null,
} = {}) {
  const albums = limit == null ? catalog.albums : catalog.albums.slice(0, limit);
  const titleIndex = new Map();
  for (const row of relevantRows) {
    const key = normalizeIdentityText(row.title);
    titleIndex.set(key, [...(titleIndex.get(key) ?? []), row]);
  }
  const results = [];
  const matchedRecords = [];
  const relatedTerms = new Map();
  for (const album of albums) {
    const titleKeys = [...new Set([album.title, ...album.aliases].map(normalizeIdentityText))];
    const candidates = titleKeys.flatMap((key) => titleIndex.get(key) ?? []);
    const match = matchAlbumToRym(album, candidates);
    let status = match.status;
    let reason = match.reason;
    let candidate = match.candidate ?? null;
    let validationErrors = [];
    if (isMatchedRymStatus(status)) {
      validationErrors = validateMatchedCandidate(candidate);
      if (validationErrors.length) {
        status = "REJECTED";
        reason = validationErrors.join(",");
        candidate = null;
      }
    }
    const record = {
      neteaseAlbumId: album.neteaseAlbumId,
      slug: album.slug,
      status,
      reason,
      inputRow: candidate?.rowNumber ?? null,
      sourceReference: candidate?.reference ?? null,
    };
    results.push(record);
    if (isMatchedRymStatus(status) && candidate) {
      const secondaryGenres = terms(candidate.secondaryGenres);
      secondaryGenres.forEach((term) => relatedTerms.set(term.key, { ...term, kind: "related" }));
      matchedRecords.push({
        neteaseAlbumId: album.neteaseAlbumId,
        matchStatus: status,
        inputSourceId,
        sourceReference: candidate.reference,
        titles: [candidate.title],
        artists: [candidate.artist],
        releaseYear: candidate.releaseYear,
        releaseType: candidate.releaseType ?? album.albumType,
        primaryGenres: terms(candidate.primaryGenres),
        secondaryGenres,
        descriptors: [],
        rymRating: candidate.rating,
        rymRatingCount: candidate.ratingCount,
        rymObservedAt: observedAt,
      });
    }
  }
  const matchedById = new Map(matchedRecords.map((record) => [record.neteaseAlbumId, record]));
  const statusById = new Map(results.map((record) => [record.neteaseAlbumId, record.status]));
  const enrichedAlbums = catalog.albums.map((album) => {
    const matched = matchedById.get(album.neteaseAlbumId);
    if (!matched) {
      return {
        ...album,
        relatedGenres: [],
        descriptors: [],
        rymRating: null,
        rymRatingCount: null,
        rymReference: null,
        rymObservedAt: null,
        rymInputSourceId: null,
        rymMatchStatus: statusById.get(album.neteaseAlbumId) ?? "UNVERIFIED_NO_DATA",
      };
    }
    return {
      ...album,
      relatedGenres: matched.secondaryGenres.map((term) => term.key),
      descriptors: [],
      rymRating: matched.rymRating,
      rymRatingCount: matched.rymRatingCount,
      rymReference: matched.sourceReference,
      rymObservedAt: matched.rymObservedAt,
      rymInputSourceId: matched.inputSourceId,
      rymMatchStatus: matched.matchStatus,
    };
  });
  const existingTaxonomy = [...catalog.taxonomy];
  const existingTaxonomyKeys = new Set(existingTaxonomy.map((item) => item.key));
  const enrichedCatalog = {
    ...catalog,
    taxonomy: [...existingTaxonomy, ...[...relatedTerms.values()].filter((item) => !existingTaxonomyKeys.has(item.key))],
    descriptorTaxonomy: [],
    albums: enrichedAlbums,
  };
  const counts = Object.fromEntries([...RYM_MATCH_STATUSES].map((status) => [status, results.filter((item) => item.status === status).length]));
  return {
    catalog: enrichedCatalog,
    snapshot: {
      version: 3,
      sourceDescription: inputSourceId,
      inputSha256,
      importedAt: observedAt,
      records: matchedRecords,
    },
    results,
    summary: {
      totalAlbums: catalog.albums.length,
      ...counts,
      ratedAlbumCount: enrichedAlbums.filter((album) => album.rymRating != null).length,
      ratingCountAlbumCount: enrichedAlbums.filter((album) => album.rymRatingCount != null).length,
      relatedGenreAlbumCount: enrichedAlbums.filter((album) => album.relatedGenres.length).length,
      relatedGenreTermCount: enrichedAlbums.reduce((total, album) => total + album.relatedGenres.length, 0),
      uniqueRelatedGenreCount: relatedTerms.size,
      coreGenreAdjustmentCount: 0,
      inputSourceId,
      inputSha256,
      observedAt,
    },
  };
}

export async function loadCheckpoint(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}
