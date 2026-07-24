const stableKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const normalize = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase("en")
  .replace(/[\p{P}\p{S}\s]+/gu, "");

const normalizedValues = (values) => new Set(values.map(normalize).filter(Boolean));

function recordIsMatchable(record) {
  return Boolean(
    record?.sourceReference &&
    Array.isArray(record.titles) &&
    record.titles.length &&
    Array.isArray(record.artists) &&
    record.artists.length &&
    /^\d{4}$/.test(String(record.releaseYear ?? "")) &&
    record.releaseType,
  );
}

export function matchesRymIdentity(album, record) {
  if (!recordIsMatchable(record)) return false;
  const albumTitles = normalizedValues([album.title, ...album.aliases]);
  const recordTitles = normalizedValues(record.titles);
  const titleMatches = [...recordTitles].some((title) => albumTitles.has(title));
  const albumArtists = normalizedValues(album.artists.map((artist) => artist.name));
  const recordArtists = normalizedValues(record.artists);
  const artistMatches = albumArtists.size === recordArtists.size &&
    [...recordArtists].every((artist) => albumArtists.has(artist));
  return titleMatches &&
    artistMatches &&
    album.releaseDate?.slice(0, 4) === String(record.releaseYear) &&
    album.albumType === record.releaseType;
}

function validTerms(terms) {
  return Array.isArray(terms) &&
    terms.every((term) =>
      stableKey.test(String(term?.key ?? "")) &&
      typeof term?.labelEn === "string" &&
      term.labelEn.trim() &&
      (term.labelZh == null || typeof term.labelZh === "string"),
    );
}

function duplicateKeys(terms) {
  const keys = terms.map((term) => term.key);
  return [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];
}

export function validateRymTaxonomySnapshot(snapshot) {
  const errors = [];
  if (![1, 2, 3].includes(snapshot?.version)) errors.push("RYM taxonomy snapshot version must be 1, 2 or 3.");
  if (!Array.isArray(snapshot?.records)) errors.push("RYM taxonomy snapshot records must be an array.");
  if (typeof snapshot?.sourceDescription !== "string" || !snapshot.sourceDescription.trim()) {
    errors.push("RYM taxonomy snapshot sourceDescription is required.");
  }
  if ((snapshot?.records?.length ?? 0) > 0) {
    const importedAt = String(snapshot?.importedAt ?? "");
    const importedDate = new Date(importedAt);
    if (!utcTimestamp.test(importedAt) || !Number.isFinite(importedDate.getTime()) || importedDate.toISOString() !== importedAt) {
      errors.push("A non-empty RYM taxonomy snapshot needs a valid UTC importedAt timestamp.");
    }
  } else if (snapshot?.importedAt != null) {
    errors.push("An empty RYM taxonomy snapshot must use importedAt: null.");
  }
  for (const [index, record] of (snapshot?.records ?? []).entries()) {
    const prefix = `records[${index}]`;
    if (!recordIsMatchable(record)) errors.push(`${prefix} is missing composite match evidence.`);
    if (!validTerms(record.primaryGenres)) errors.push(`${prefix}.primaryGenres is invalid.`);
    if (!validTerms(record.secondaryGenres)) errors.push(`${prefix}.secondaryGenres is invalid.`);
    if (!validTerms(record.descriptors)) errors.push(`${prefix}.descriptors is invalid.`);
    if (record.rymRating != null && (!Number.isFinite(record.rymRating) || record.rymRating <= 0 || record.rymRating > 5)) {
      errors.push(`${prefix}.rymRating must be null or a finite number greater than 0 and at most 5.`);
    }
    if (record.rymRatingCount != null && (!Number.isInteger(record.rymRatingCount) || record.rymRatingCount < 0)) {
      errors.push(`${prefix}.rymRatingCount must be null or a non-negative integer.`);
    }
    if (record.rymRating == null && record.rymRatingCount != null) {
      errors.push(`${prefix}.rymRatingCount cannot be published without rymRating.`);
    }
    if (record.rymRating != null) {
      const observedAt = String(record.rymObservedAt ?? "");
      const observedDate = new Date(observedAt);
      if (!utcTimestamp.test(observedAt) || !Number.isFinite(observedDate.getTime()) || observedDate.toISOString() !== observedAt) {
        errors.push(`${prefix}.rymObservedAt is required for a published rating.`);
      }
    }
    if (validTerms(record.primaryGenres) && validTerms(record.secondaryGenres) && validTerms(record.descriptors)) {
      for (const field of ["primaryGenres", "secondaryGenres", "descriptors"]) {
        for (const key of duplicateKeys(record[field])) errors.push(`${prefix}.${field} contains duplicate key ${key}.`);
      }
      const primaryKeys = new Set(record.primaryGenres.map((term) => term.key));
      for (const key of new Set(record.secondaryGenres.map((term) => term.key))) {
        if (primaryKeys.has(key)) errors.push(`${prefix} repeats ${key} in primaryGenres and secondaryGenres.`);
      }
    }
  }
  return errors;
}

export function resolveRymTaxonomy(album, manualCoreGenres, records) {
  const candidates = records.filter((record) =>
    record.neteaseAlbumId
      ? String(record.neteaseAlbumId) === String(album.neteaseAlbumId)
      : matchesRymIdentity(album, record));
  const evidence = {
    titleAndAliases: [album.title, ...album.aliases],
    artists: album.artists.map((artist) => artist.name),
    releaseYear: album.releaseDate?.slice(0, 4) ?? null,
    releaseType: album.albumType,
  };
  if (candidates.length !== 1) {
    return {
      taxonomy: {
        coreGenres: [...manualCoreGenres],
        relatedGenres: [],
        descriptors: [],
      },
      rym: {
        rymRating: null,
        rymRatingCount: null,
        rymReference: null,
        rymObservedAt: null,
        rymMatchStatus: candidates.length ? "AMBIGUOUS" : "UNVERIFIED_NO_DATA",
      },
      terms: { primary: [], secondary: [], descriptors: [] },
      audit: {
        albumId: album.neteaseAlbumId,
        slug: album.slug,
        status: candidates.length ? "ambiguous" : "unmatched",
        reason: candidates.length ? "multiple_composite_matches" : "no_authorized_offline_record",
        evidence,
        candidateReferences: candidates.map((record) => record.sourceReference),
      },
    };
  }
  const [record] = candidates;
  return {
    taxonomy: {
      coreGenres: [...manualCoreGenres],
      relatedGenres: record.secondaryGenres.map((term) => term.key),
      descriptors: [],
    },
    terms: {
      primary: record.primaryGenres,
      secondary: record.secondaryGenres,
      descriptors: record.descriptors,
    },
    rym: {
      rymRating: record.rymRating ?? null,
      rymRatingCount: record.rymRating == null ? null : record.rymRatingCount ?? null,
      rymReference: record.sourceReference,
      rymObservedAt: record.rymObservedAt ?? null,
      rymInputSourceId: record.inputSourceId ?? null,
      rymMatchStatus: record.matchStatus ?? "MATCHED",
    },
    audit: {
      albumId: album.neteaseAlbumId,
      slug: album.slug,
      status: "matched",
      reason: "unique_title_artist_year_type_match",
      evidence,
      candidateReferences: [record.sourceReference],
    },
  };
}

export function formatTaxonomyLabel(term) {
  return term.labelZh?.trim() ? `${term.labelZh.trim()}（${term.labelEn.trim()}）` : term.labelEn.trim();
}
