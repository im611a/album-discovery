import { ARTIST_STATE, DUPLICATE_STATE, finding, SEVERITY } from "./contracts.mjs";
import { normalizeComparison } from "./utils.mjs";
import { safeSlug } from "../sync-catalog.mjs";

const editionPattern = /(?:deluxe|remaster(?:ed)?|live|anniversary|expanded(?:\s+edition)?|special\s+edition|豪华|重制|纪念|现场)/iu;
const editionReplacePattern = /(?:deluxe|remaster(?:ed)?|live|anniversary|expanded(?:\s+edition)?|special\s+edition|edition|豪华|重制|纪念|现场|版本)/giu;
const stableSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const artistKey = (album) => (album.artists ?? []).map((artist) => String(artist.neteaseArtistId)).sort().join("|");
const releaseYear = (album) => String(album.releaseDate ?? "").slice(0, 4);
const baseEditionTitle = (value) => normalizeComparison(String(value ?? "").replace(editionReplacePattern, ""));

export function buildArtistAuthority(catalog) {
  const byId = new Map();
  const byName = new Map();
  for (const album of catalog.albums ?? []) {
    for (const artist of album.artists ?? []) {
      const id = String(artist.neteaseArtistId);
      if (!byId.has(id)) byId.set(id, artist.name);
      const name = normalizeComparison(artist.name);
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(id);
    }
  }
  return { byId, byName };
}

export function resolveAlbumArtists(artists, authority) {
  const states = [];
  const findings = [];
  const seen = new Map();
  for (const artist of artists ?? []) {
    const id = String(artist?.neteaseArtistId ?? "").trim();
    const name = String(artist?.name ?? "").trim();
    if (!/^\d+$/.test(id) || BigInt(id || "0") <= 0n) {
      const candidates = authority.byName.get(normalizeComparison(name));
      const state = candidates?.size ? ARTIST_STATE.AMBIGUOUS_ARTIST : name ? ARTIST_STATE.INVALID_ARTIST_ID : ARTIST_STATE.UNKNOWN_ARTIST;
      states.push({ id, name, state, candidates: candidates ? [...candidates].sort() : [] });
      findings.push(finding(state === ARTIST_STATE.AMBIGUOUS_ARTIST ? SEVERITY.NEEDS_REVIEW : SEVERITY.ERROR, state, `Artist ${name || "(missing)"} does not have a positive authoritative ID.`, "Provide a positive structured NetEase Artist ID."));
      continue;
    }
    if (seen.has(id)) {
      const conflict = seen.get(id) !== name;
      const state = conflict ? ARTIST_STATE.DUPLICATE_ARTIST_ID_CONFLICT : ARTIST_STATE.DUPLICATE_ARTIST_ID_CONFLICT;
      states.push({ id, name, state });
      findings.push(finding(SEVERITY.ERROR, state, `Artist ID ${id} occurs more than once in the Album credits${conflict ? " with conflicting names" : ""}.`, "Correct the provider credit identities."));
      continue;
    }
    seen.set(id, name);
    const existingName = authority.byId.get(id);
    if (existingName && normalizeComparison(existingName) !== normalizeComparison(name)) {
      states.push({ id, name, state: ARTIST_STATE.ARTIST_ID_NAME_CONFLICT, existingName });
      findings.push(finding(SEVERITY.NEEDS_REVIEW, ARTIST_STATE.ARTIST_ID_NAME_CONFLICT, `Artist ID ${id} is published as ${existingName}, not ${name}.`, "Review the provider source and existing Artist identity."));
    } else if (existingName) states.push({ id, name, state: ARTIST_STATE.RESOLVED_EXISTING_ARTIST });
    else states.push({ id, name, state: ARTIST_STATE.CREATE_NEW_ARTIST });
  }
  return { states, findings };
}

export function classifyDuplicate(album, catalog) {
  const exact = (catalog.albums ?? []).find((item) => item.neteaseAlbumId === album.neteaseAlbumId);
  if (exact) return { state: DUPLICATE_STATE.EXACT_DUPLICATE, conflict: { id: exact.neteaseAlbumId, slug: exact.slug, title: exact.title } };
  const title = normalizeComparison(album.title);
  const artists = artistKey(album);
  const year = releaseYear(album);
  const likely = (catalog.albums ?? []).find((item) => normalizeComparison(item.title) === title && artistKey(item) === artists && releaseYear(item) === year && item.albumType === album.albumType);
  if (likely) return { state: DUPLICATE_STATE.LIKELY_DUPLICATE, conflict: { id: likely.neteaseAlbumId, slug: likely.slug, title: likely.title } };
  const editionBase = baseEditionTitle(album.title);
  const artistIds = new Set((album.artists ?? []).map((artist) => String(artist.neteaseArtistId)));
  const edition = (catalog.albums ?? []).find((item) => baseEditionTitle(item.title) === editionBase && (item.artists ?? []).some((artist) => artistIds.has(String(artist.neteaseArtistId))));
  if (edition && (editionPattern.test(album.title) || editionPattern.test(edition.title) || normalizeComparison(edition.title) !== title)) {
    return { state: DUPLICATE_STATE.POSSIBLE_EDITION, conflict: { id: edition.neteaseAlbumId, slug: edition.slug, title: edition.title } };
  }
  return { state: DUPLICATE_STATE.DISTINCT, conflict: null };
}

export function allocateDeterministicSlugs(proposals, existingCatalog) {
  const existing = new Set((existingCatalog.albums ?? []).map((album) => album.slug));
  const prepared = proposals.map((proposal) => ({
    ...proposal,
    baseSlug: proposal.slugOverride ?? safeSlug(proposal.title, proposal.albumId),
  }));
  const counts = new Map();
  for (const proposal of prepared) counts.set(proposal.baseSlug, (counts.get(proposal.baseSlug) ?? 0) + 1);
  return prepared
    .sort((a, b) => a.albumId.localeCompare(b.albumId, "en-US", { numeric: true }))
    .map((proposal) => {
      const findings = [];
      if (proposal.slugOverride) {
        findings.push(finding(SEVERITY.NEEDS_REVIEW, "SLUG_OVERRIDE_REVIEW_REQUIRED", `Explicit slug override requested: ${proposal.slugOverride}.`, "Review and authorize the override."));
      }
      if (!stableSlug.test(proposal.baseSlug)) {
        findings.push(finding(SEVERITY.ERROR, "INVALID_SLUG", `Invalid proposed slug: ${proposal.baseSlug}.`, "Remove or correct slug_override."));
      }
      const collision = existing.has(proposal.baseSlug) || counts.get(proposal.baseSlug) > 1;
      const slug = collision ? `${proposal.baseSlug}-${proposal.albumId}` : proposal.baseSlug;
      if (existing.has(slug)) findings.push(finding(SEVERITY.ERROR, "SLUG_COLLISION", `Proposed slug ${slug} already exists.`, "Review the Album ID or explicit slug override."));
      return { ...proposal, slug, collision, findings };
    });
}
