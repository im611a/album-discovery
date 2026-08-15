import { ARTIST_STATE, DUPLICATE_STATE, finding, SEVERITY } from "./contracts.mjs";
import { buildArtistAuthority, classifyDuplicate, resolveAlbumArtists } from "./identity.mjs";
import { normalizeComparison } from "./utils.mjs";

const knownScenes = new Set(["commute", "night", "solitude", "focus", "relax", "exercise", "social"]);

export function validateProposedAlbum({ row, album, catalog }) {
  const findings = [...row.findings];
  const coreGenres = new Set((catalog.taxonomy ?? []).filter((item) => item.kind === "core").map((item) => item.key));
  if (album.neteaseAlbumId !== row.albumId) findings.push(finding(SEVERITY.ERROR, "ALBUM_ID_SOURCE_MISMATCH", `Provider Album ID ${album.neteaseAlbumId} does not match input ${row.albumId}.`, "Correct the input or authoritative payload."));
  const releaseDate = String(album.releaseDate ?? "");
  const parsedReleaseDate = new Date(`${releaseDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) || album.releaseDatePrecision !== "day" || !Number.isFinite(parsedReleaseDate.getTime()) || parsedReleaseDate.toISOString().slice(0, 10) !== releaseDate) {
    findings.push(finding(SEVERITY.ERROR, "INVALID_RELEASE_DATE", "New Album payload requires a valid date and matching day precision.", "Repair provider release date/precision; do not guess."));
  }
  if (normalizeComparison(row.expectedTitle) !== normalizeComparison(album.title)) {
    findings.push(finding(SEVERITY.NEEDS_REVIEW, "TITLE_ASSERTION_MISMATCH", `Expected title ${row.expectedTitle} differs from provider title ${album.title}.`, "Review the source payload and assertion."));
  }
  const expectedArtists = row.expectedArtists.map(normalizeComparison).sort();
  const actualArtists = (album.artists ?? []).map((artist) => normalizeComparison(artist.name)).sort();
  if (JSON.stringify(expectedArtists) !== JSON.stringify(actualArtists)) {
    findings.push(finding(SEVERITY.NEEDS_REVIEW, "ARTIST_ASSERTION_MISMATCH", "Expected Artist assertions differ from structured provider credits.", "Review the complete Artist credit set."));
  }
  for (const key of row.coreGenres) if (!coreGenres.has(key)) findings.push(finding(SEVERITY.ERROR, "UNKNOWN_CORE_GENRE", `Unknown core genre key: ${key}.`, "Use an existing reviewed core taxonomy key."));
  if (row.contexts.length > 3 || row.contexts.some((key) => !knownScenes.has(key))) findings.push(finding(SEVERITY.ERROR, "INVALID_CONTEXT", "contexts must contain at most three known listening-scene keys.", "Correct contexts."));
  if (row.refresh) findings.push(finding(SEVERITY.NEEDS_REVIEW, "REFRESH_REVIEW_REQUIRED", "Existing-record refresh requires separate human review.", "Obtain explicit refresh authorization."));
  const artistResolution = resolveAlbumArtists(album.artists, buildArtistAuthority(catalog));
  findings.push(...artistResolution.findings);
  if (!Array.isArray(album.tracks) || album.tracks.length < 2) findings.push(finding(SEVERITY.ERROR, "INVALID_TRACK_LIST", "A complete multi-track list is required.", "Repair the authoritative payload."));
  const ids = new Set();
  const positions = new Set();
  for (const track of album.tracks ?? []) {
    if (!track.id || !track.neteaseTrackId || !/^\d+$/.test(String(track.neteaseTrackId))) findings.push(finding(SEVERITY.ERROR, "INVALID_TRACK_ID", `Invalid Track identity for ${track.title ?? "(untitled)"}.`, "Repair the authoritative payload."));
    if (ids.has(track.id)) findings.push(finding(SEVERITY.ERROR, "DUPLICATE_TRACK_ID", `Duplicate Track ID ${track.id}.`, "Repair the authoritative payload."));
    ids.add(track.id);
    if (!Number.isInteger(track.discNumber) || track.discNumber < 1 || !Number.isInteger(track.trackNumber) || track.trackNumber < 1) findings.push(finding(SEVERITY.ERROR, "INVALID_TRACK_ORDER", `Invalid Track order for ${track.title}.`, "Repair disc/track numbers."));
    const position = `${track.discNumber}:${track.trackNumber}`;
    if (positions.has(position)) findings.push(finding(SEVERITY.ERROR, "DUPLICATE_TRACK_POSITION", `Duplicate Track position ${position}.`, "Repair disc/track ordering."));
    positions.add(position);
    if (!Number.isFinite(track.durationMs) || track.durationMs < 0) findings.push(finding(SEVERITY.ERROR, "INVALID_TRACK_DURATION", `Invalid duration for ${track.title}.`, "Repair the authoritative payload."));
    if (!Array.isArray(track.artists) || track.artists.some((artist) => !String(artist).trim())) findings.push(finding(SEVERITY.ERROR, "INVALID_TRACK_ARTISTS", `Invalid Track Artist credits for ${track.title}.`, "Repair the authoritative payload."));
  }
  const expectedSearch = [album.title, ...(album.aliases ?? []), ...(album.artists ?? []).map((artist) => artist.name)].join(" ");
  if (album.searchText !== expectedSearch) findings.push(finding(SEVERITY.ERROR, "SEARCH_TEXT_DRIFT", "searchText is not the deterministic published projection.", "Regenerate searchText."));
  const duplicate = classifyDuplicate(album, catalog);
  if (duplicate.state === DUPLICATE_STATE.LIKELY_DUPLICATE) findings.push(finding(SEVERITY.NEEDS_REVIEW, duplicate.state, "A different Album ID strongly matches an existing record.", "Review the conflicting release/edition.", { conflict: duplicate.conflict }));
  if (duplicate.state === DUPLICATE_STATE.POSSIBLE_EDITION) findings.push(finding(SEVERITY.NEEDS_REVIEW, duplicate.state, "This may be another edition of an existing Album.", "Review edition identity; do not merge automatically.", { conflict: duplicate.conflict }));
  return { findings, artistResolution, duplicate };
}

export function knownFrozenArtistDebt(catalog) {
  const debt = (catalog.albums ?? []).filter((album) => (album.artists ?? []).some((artist) => String(artist.neteaseArtistId) === "0"));
  const exact = debt.length === 1 && debt[0].slug === "netease-281405720" && debt[0].artists.filter((artist) => String(artist.neteaseArtistId) === "0").map((artist) => artist.name).sort().join("|") === ["奚晓天", "张旖旎"].sort().join("|");
  return exact
    ? { state: ARTIST_STATE.KNOWN_FROZEN_ARTIST_ID_0_DEBT, count: 1, albumIds: [debt[0].neteaseAlbumId] }
    : { state: "UNEXPECTED_ARTIST_ID_0_DEBT", count: debt.length, albumIds: debt.map((album) => album.neteaseAlbumId) };
}
