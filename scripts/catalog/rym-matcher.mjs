const MATCHED_STATUSES = new Set(["MATCHED_EXACT", "MATCHED_ALIAS", "MATCHED_STRONG"]);

export const normalizeIdentityText = (value) => String(value ?? "")
  .normalize("NFKC")
  .replace(/[《》「」『』“”‘’]/g, "")
  .toLocaleLowerCase("en")
  .replace(/\bfeat(?:uring)?\.?\b/gi, " ")
  .replace(/[\p{P}\p{S}\s]+/gu, "");

const normalizedArtistSet = (artists) => new Set(artists.map((artist) => normalizeIdentityText(artist)).filter(Boolean));

function artistsMatch(album, candidate) {
  const expected = normalizedArtistSet(album.artists.map((artist) => artist.name));
  if (!candidate.artist) return false;
  if (expected.size === 1) return expected.has(normalizeIdentityText(candidate.artist));
  const pieces = candidate.artist.split(/\s+(?:&|and|和|、|\/)\s+|[、/]/i);
  const actual = normalizedArtistSet(pieces);
  if (actual.size === expected.size && [...expected].every((value) => actual.has(value))) return true;
  const combined = normalizeIdentityText(candidate.artist);
  return combined === [...expected].join("") || combined === [...expected].sort().join("");
}

function titleMatchKind(album, candidate) {
  const candidateTitle = normalizeIdentityText(candidate.title);
  if (!candidateTitle) return null;
  if (normalizeIdentityText(album.title) === candidateTitle) return "title";
  if (album.aliases.some((alias) => normalizeIdentityText(alias) === candidateTitle)) return "alias";
  return null;
}

function compatibleType(albumType, candidateType) {
  return candidateType == null || candidateType === albumType;
}

export function classifyRymCandidate(album, candidate) {
  const titleKind = titleMatchKind(album, candidate);
  if (!titleKind || !artistsMatch(album, candidate)) return null;
  const year = album.releaseDate?.slice(0, 4) ?? null;
  if (!compatibleType(album.albumType, candidate.releaseType) || candidate.releaseType === "single") {
    return { status: "REJECTED", reason: "release_type_conflict", candidate };
  }
  if (!year || !candidate.releaseYear) return { status: "AMBIGUOUS", reason: "missing_release_year", candidate };
  const yearDifference = Math.abs(Number(year) - Number(candidate.releaseYear));
  if (yearDifference === 0) {
    return {
      status: titleKind === "alias" ? "MATCHED_ALIAS" : "MATCHED_EXACT",
      reason: titleKind === "alias" ? "alias_artist_year_type" : "title_artist_year_type",
      candidate,
    };
  }
  if (yearDifference === 1) {
    return { status: "MATCHED_STRONG", reason: "title_artist_adjacent_year_type", candidate };
  }
  return { status: "REJECTED", reason: "release_year_conflict", candidate };
}

export function matchAlbumToRym(album, candidates) {
  const classified = candidates.map((candidate) => classifyRymCandidate(album, candidate)).filter(Boolean);
  const matches = classified.filter((item) => MATCHED_STATUSES.has(item.status));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { status: "AMBIGUOUS", reason: "multiple_reliable_candidates", candidates: matches.map((item) => item.candidate) };
  const rejection = classified.find((item) => item.status === "REJECTED");
  if (rejection) return rejection;
  const ambiguous = classified.find((item) => item.status === "AMBIGUOUS");
  if (ambiguous) return ambiguous;
  return { status: "NOT_FOUND", reason: "no_title_artist_candidate" };
}

export function isMatchedRymStatus(status) {
  return MATCHED_STATUSES.has(status);
}

export function stableGenreKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
