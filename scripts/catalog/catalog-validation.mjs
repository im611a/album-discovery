import { REQUIRED_NETEASE_SAMPLES } from "./netease-seeds.mjs";
import { resolveRymTaxonomy } from "./rym-taxonomy.mjs";

const neteaseAlbumUrl = /^https:\/\/music\.163\.com\/#\/album\?id=(\d+)$/;
const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const partialDate = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
const stableKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validCalendarDate(value) {
  if (!partialDate.test(value)) return false;
  const [year, month = "01", day = "01"] = value.split("-");
  const normalized = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return Number.isFinite(normalized.getTime()) &&
    normalized.toISOString().slice(0, value.length) === value;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateCatalogData(catalog, identities = {}, rymSnapshot = { records: [] }) {
  const errors = [];
  if (catalog?.version !== 2) errors.push("Catalog version must be 2.");
  if (catalog?.source?.catalog !== "netease") errors.push("Catalog authority must be NetEase.");
  if (catalog?.source?.runtimeRequestsAllowed !== false) errors.push("Runtime provider requests must be disabled.");
  if (catalog?.source?.taxonomy !== "rym-offline-or-manual-core") errors.push("Catalog taxonomy source boundary is invalid.");
  if (!isoTimestamp.test(String(catalog?.source?.generatedAt ?? ""))) errors.push("Catalog generatedAt must be a UTC ISO timestamp.");
  if (!Array.isArray(catalog?.albums) || !catalog.albums.length) errors.push("Catalog must contain albums.");
  if (!Array.isArray(catalog?.taxonomy)) errors.push("Catalog taxonomy must be an array.");
  if (!Array.isArray(catalog?.descriptorTaxonomy)) errors.push("Descriptor taxonomy must be an array.");
  const albums = Array.isArray(catalog?.albums) ? catalog.albums : [];
  if (albums.length < 300) errors.push(`Catalog must contain at least 300 validated albums; received ${albums.length}.`);
  const ids = albums.map((album) => album.neteaseAlbumId);
  const slugs = albums.map((album) => album.slug);
  for (const duplicate of duplicateValues(ids)) errors.push(`Duplicate NetEase album ID: ${duplicate}`);
  for (const duplicate of duplicateValues(slugs)) errors.push(`Duplicate slug: ${duplicate}`);
  const semanticIdentities = albums.map((album) => `${album.artists?.[0]?.neteaseArtistId ?? ""}:${normalizeName(album.title)}:${album.releaseDate?.slice(0, 4) ?? ""}`);
  for (const duplicate of duplicateValues(semanticIdentities)) errors.push(`Duplicate artist/title/year identity: ${duplicate}`);
  const coreTaxonomyKeys = new Set((catalog?.taxonomy ?? []).filter((item) => item.kind === "core").map((item) => item.key));
  const relatedTaxonomyKeys = new Set((catalog?.taxonomy ?? []).filter((item) => item.kind === "related").map((item) => item.key));
  const descriptorKeys = new Set((catalog?.descriptorTaxonomy ?? []).map((item) => item.key));
  for (const duplicate of duplicateValues((catalog?.taxonomy ?? []).map((item) => item.key))) errors.push(`Duplicate taxonomy key: ${duplicate}`);
  for (const duplicate of duplicateValues((catalog?.descriptorTaxonomy ?? []).map((item) => item.key))) errors.push(`Duplicate descriptor key: ${duplicate}`);
  for (const item of catalog?.taxonomy ?? []) {
    if (!stableKey.test(String(item.key))) errors.push(`Invalid taxonomy key: ${item.key}`);
    if (!["core", "related"].includes(item.kind)) errors.push(`Invalid taxonomy kind for ${item.key}.`);
    if (!item.labelEn || (item.labelZh != null && !String(item.labelZh).trim())) errors.push(`Taxonomy ${item.key} needs an English label and an optional non-empty Chinese label.`);
  }
  for (const item of catalog?.descriptorTaxonomy ?? []) {
    if (!stableKey.test(String(item.key))) errors.push(`Invalid descriptor key: ${item.key}`);
    if (item.kind !== "descriptor") errors.push(`Invalid descriptor kind for ${item.key}.`);
    if (!item.labelEn || (item.labelZh != null && !String(item.labelZh).trim())) errors.push(`Descriptor ${item.key} needs an English label and an optional non-empty Chinese label.`);
  }
  for (const album of albums) {
    const prefix = album?.slug ?? album?.neteaseAlbumId ?? "unknown";
    if (!/^\d+$/.test(String(album?.neteaseAlbumId ?? ""))) errors.push(`${prefix}: invalid NetEase album ID.`);
    if (album?.internalId !== `album:${album?.neteaseAlbumId}` || album?.id !== album?.internalId) errors.push(`${prefix}: unstable internal ID.`);
    if (!stableKey.test(String(album?.slug ?? ""))) errors.push(`${prefix}: invalid slug.`);
    if (!album?.title || !Array.isArray(album?.artists) || !album.artists.length) errors.push(`${prefix}: title and artists are required.`);
    if (album?.releaseDate && !validCalendarDate(album.releaseDate)) errors.push(`${prefix}: invalid release date.`);
    if (album?.releaseDate && album?.releaseDatePrecision !== ({ 4: "year", 7: "month", 10: "day" })[album.releaseDate.length]) errors.push(`${prefix}: release date precision mismatch.`);
    if (!["album", "ep", "mixtape", "soundtrack"].includes(album?.albumType)) errors.push(`${prefix}: invalid album type.`);
    if (!Number.isInteger(album?.trackCount) || album.trackCount < 2) errors.push(`${prefix}: invalid track count.`);
    if (!Array.isArray(album?.tracks)) errors.push(`${prefix}: tracks must be an array.`);
    if (album.trackCount !== album?.tracks?.length) errors.push(`${prefix}: track count does not match the published track list.`);
    const urlMatch = String(album?.externalUrl ?? "").match(neteaseAlbumUrl);
    if (!urlMatch || urlMatch[1] !== String(album.neteaseAlbumId)) errors.push(`${prefix}: external URL is not the matching NetEase album page.`);
    if (!isoTimestamp.test(String(album?.discoveredAt ?? "")) || !isoTimestamp.test(String(album?.updatedAt ?? ""))) errors.push(`${prefix}: discovery timestamps must be UTC ISO values.`);
    if (!["local", "fallback"].includes(album?.cover?.kind)) errors.push(`${prefix}: invalid cover kind.`);
    if (album?.cover?.kind === "local" && !/^\/catalog\/covers\/\d+\.jpg$/.test(String(album.cover.src))) errors.push(`${prefix}: local cover path must use the NetEase album ID.`);
    if (album?.cover?.kind === "fallback" && album.cover.src !== null) errors.push(`${prefix}: fallback cover must not pretend to be a real image.`);
    if (!album?.coreGenres?.length) errors.push(`${prefix}: at least one reviewed core genre is required.`);
    if (album?.source?.catalog !== "netease" || album?.source?.error !== null || !isoTimestamp.test(String(album?.source?.fetchedAt ?? "")) || !album?.source?.parserVersion || !album?.source?.verificationMethod) {
      errors.push(`${prefix}: incomplete NetEase source provenance.`);
    }
    for (const channel of album?.sourceMarketChannels ?? []) if (!["ALL", "ZH", "EA", "JP", "KR"].includes(channel)) errors.push(`${prefix}: invalid market channel ${channel}.`);
    for (const key of album?.coreGenres ?? []) if (!coreTaxonomyKeys.has(key)) errors.push(`${prefix}: unknown core genre ${key}.`);
    for (const key of album?.relatedGenres ?? []) if (!relatedTaxonomyKeys.has(key)) errors.push(`${prefix}: unknown related genre ${key}.`);
    for (const key of album?.descriptors ?? []) if (!descriptorKeys.has(key)) errors.push(`${prefix}: unknown descriptor ${key}.`);
    const resolvedTaxonomy = resolveRymTaxonomy(album, album?.coreGenres ?? [], rymSnapshot?.records ?? []).taxonomy;
    const publishedTaxonomy = {
      coreGenres: album?.coreGenres ?? [],
      relatedGenres: album?.relatedGenres ?? [],
      descriptors: album?.descriptors ?? [],
    };
    if (JSON.stringify(resolvedTaxonomy) !== JSON.stringify(publishedTaxonomy)) {
      errors.push(`${prefix}: published taxonomy does not match the unique offline RYM record or manual-core fallback.`);
    }
    const forbiddenKeys = ["musicbrainzReleaseGroupId", "representativeReleaseId", "sourceSummary", "primaryGenres", "secondaryGenres", "externalLinks"];
    for (const key of forbiddenKeys) if (key in album) errors.push(`${prefix}: legacy production field ${key} is forbidden.`);
    const fixed = identities[album.slug];
    if (fixed && String(fixed.albumId) !== String(album.neteaseAlbumId)) errors.push(`${prefix}: fixed NetEase identity mismatch.`);
  }
  for (const required of REQUIRED_NETEASE_SAMPLES) {
    const album = albums.find((item) => item.neteaseAlbumId === required.albumId);
    if (!album) errors.push(`Required NetEase sample is missing: ${required.artist} / ${required.title}.`);
    else if (album.title !== required.title || !album.artists.some((artist) => normalizeName(artist.name).includes(normalizeName(required.artist)) || normalizeName(required.artist).includes(normalizeName(artist.name)))) {
      errors.push(`Required NetEase sample identity mismatch: ${required.albumId}.`);
    }
  }
  const summary = {
    albums: albums.length,
    uniqueNeteaseAlbumIds: new Set(ids).size,
    uniqueSlugs: new Set(slugs).size,
    localCovers: albums.filter((album) => album.cover?.kind === "local").length,
    fallbackCovers: albums.filter((album) => album.cover?.kind === "fallback").length,
    albumsWithTracks: albums.filter((album) => album.tracks?.length).length,
    albumsWithNeteaseLinks: albums.filter((album) => neteaseAlbumUrl.test(String(album.externalUrl))).length,
    coreGenres: new Set(albums.flatMap((album) => album.coreGenres ?? [])).size,
    relatedGenres: new Set(albums.flatMap((album) => album.relatedGenres ?? [])).size,
    descriptors: new Set(albums.flatMap((album) => album.descriptors ?? [])).size,
    multiChannelAlbums: albums.filter((album) => (album.sourceMarketChannels?.length ?? 0) > 1).length,
  };
  return { ok: errors.length === 0, errors, summary };
}

function normalizeName(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\s]+/gu, "");
}
