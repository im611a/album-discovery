import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { requestSourceBytes } from "./acquisition.mjs";
import { fingerprint, sha256Bytes, sha256File, stableJson } from "./utils.mjs";

export const DISCOVERY_SNAPSHOT_SCHEMA = "content-pipeline-v1/discovery-snapshot/v1";
export const DISCOVERY_CANDIDATE_SCHEMA = "content-pipeline-v1/discovery-candidates/v1";
export const DISCOVERY_CACHE_SCHEMA = "content-pipeline-v1/discovery-cache/v1";
export const DISCOVERY_TYPES = Object.freeze(["album", "ep", "single", "compilation", "live", "soundtrack", "other"]);
export const DEFAULT_DISCOVERY_TYPES = Object.freeze(["album", "ep"]);

const METADATA_HOST = "music.163.com";
const SOURCE_PRIORITY = Object.freeze({ "current-artists": 0, "public-new-albums": 1 });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function discoveryError(code, message, details = {}) {
  return Object.assign(new Error(`${code}: ${message}`), { code, ...details });
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return fallback; throw error; }
}

async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, stableJson(value), "utf8");
  await rm(file, { force: true });
  await rename(temporary, file);
}

function decimalId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/u.test(id) && BigInt(id) > 0n ? id : null;
}

export function classifyDiscoveryAlbumType(album) {
  const type = String(album?.type ?? "").trim().toLocaleLowerCase("en-US");
  const subtype = String(album?.subType ?? "").trim().toLocaleLowerCase("en-US");
  const combined = `${type} ${subtype}`;
  if (type === "single" || type === "单曲") return "single";
  if (type === "ep") return "ep";
  if (combined.includes("soundtrack") || combined.includes("原声")) return "soundtrack";
  if (combined.includes("compilation") || combined.includes("精选") || combined.includes("合集")) return "compilation";
  if (combined.includes("live") || combined.includes("现场")) return "live";
  if (type === "album" || type === "专辑") return "album";
  return "other";
}

function normalizeDiscoveryAlbum(album, source) {
  const neteaseAlbumId = decimalId(album?.id);
  const title = String(album?.name ?? "").trim();
  const artists = (album?.artists ?? album?.ar ?? [])
    .map((artist) => ({ neteaseArtistId: decimalId(artist?.id), name: String(artist?.name ?? "").trim() }))
    .filter((artist) => artist.name);
  if (!neteaseAlbumId || !title || !artists.length) throw discoveryError("MALFORMED_DISCOVERY_ALBUM", `Source ${source.kind} returned an Album without positive ID, title, or Artist names.`);
  const publishTime = Number(album?.publishTime);
  return {
    neteaseAlbumId,
    title,
    artists,
    albumType: classifyDiscoveryAlbumType(album),
    sourceType: String(album?.type ?? "") || null,
    sourceSubType: String(album?.subType ?? "") || null,
    trackCountHint: Number.isInteger(Number(album?.size)) && Number(album.size) >= 0 ? Number(album.size) : null,
    publishTime: Number.isFinite(publishTime) ? publishTime : null,
    sources: [source],
  };
}

function cacheNames(source, key) {
  const safeSource = source.replace(/[^a-z0-9-]/gu, "-");
  const safeKey = key.replace(/[^a-z0-9-]/gu, "-");
  return { directory: safeSource, index: `${safeKey}.index.json`, prefix: safeKey };
}

async function readDiscoveryCache(cacheRoot, source, key) {
  const names = cacheNames(source, key);
  const indexFile = path.join(cacheRoot, names.directory, names.index);
  const index = await readJson(indexFile);
  if (!index) return null;
  if (index.schema !== DISCOVERY_CACHE_SCHEMA || index.source !== source || index.key !== key || !/^[a-f0-9]{64}$/u.test(String(index.responseSha256 ?? ""))) {
    throw discoveryError("DISCOVERY_CACHE_CORRUPT", indexFile);
  }
  const recordFile = path.join(cacheRoot, names.directory, `${names.prefix}-${index.responseSha256}.json`);
  const record = await readJson(recordFile);
  if (!record || record.schema !== DISCOVERY_CACHE_SCHEMA || record.source !== source || record.key !== key || record.responseSha256 !== index.responseSha256) {
    throw discoveryError("DISCOVERY_CACHE_CORRUPT", recordFile);
  }
  const bytes = Buffer.from(String(record.responseBodyBase64 ?? ""), "base64");
  if (sha256Bytes(bytes) !== record.responseSha256) throw discoveryError("DISCOVERY_CACHE_HASH_MISMATCH", recordFile);
  let payload;
  try { payload = JSON.parse(bytes.toString("utf8")); }
  catch { throw discoveryError("DISCOVERY_CACHE_JSON_INVALID", recordFile); }
  return { payload, responseSha256: record.responseSha256, recordedAt: record.recordedAt, file: recordFile };
}

async function writeDiscoveryCache(cacheRoot, source, key, url, bytes, recordedAt) {
  const names = cacheNames(source, key);
  const responseSha256 = sha256Bytes(bytes);
  const directory = path.join(cacheRoot, names.directory);
  const recordFile = path.join(directory, `${names.prefix}-${responseSha256}.json`);
  if (!(await stat(recordFile).catch(() => null))) {
    await writeJsonAtomic(recordFile, { schema: DISCOVERY_CACHE_SCHEMA, source, key, url, recordedAt, responseSha256, responseBodyBase64: bytes.toString("base64") });
  }
  await writeJsonAtomic(path.join(directory, names.index), { schema: DISCOVERY_CACHE_SCHEMA, source, key, responseSha256, recordedAt });
  return { responseSha256, file: recordFile };
}

function createRequestScheduler({ minimumGapMs, delayImpl }) {
  let chain = Promise.resolve();
  let nextStart = 0;
  return async function schedule(action) {
    let release;
    const previous = chain;
    chain = new Promise((resolve) => { release = resolve; });
    await previous;
    const wait = Math.max(0, nextStart - Date.now());
    if (wait) await delayImpl(wait);
    nextStart = Date.now() + minimumGapMs;
    release();
    return action();
  };
}

function retryableStatus(error) {
  return error?.code === "ACQUISITION_TIMEOUT" || Number(error?.status) === 429 || Number(error?.status) >= 500 && Number(error?.status) <= 599;
}

async function requestDiscoveryPage({ runtime, source, key, url, validate, legacyFile = null }) {
  const current = await readDiscoveryCache(runtime.cacheRoot, source, key);
  if (current && !runtime.refresh) {
    runtime.accounting.cacheHits += 1;
    validate(current.payload);
    return { ...current, cache: "HIT", attempts: 0, sourceDrift: false };
  }
  if (!current && !runtime.refresh && legacyFile) {
    const legacyBytes = await readFile(legacyFile).catch((error) => { if (error?.code === "ENOENT") return null; throw error; });
    if (legacyBytes) {
      const payload = JSON.parse(legacyBytes.toString("utf8"));
      validate(payload);
      runtime.accounting.cacheHits += 1;
      runtime.accounting.legacyCacheHits += 1;
      return { payload, responseSha256: sha256Bytes(legacyBytes), recordedAt: payload?._catalogRequest?.requestedAt ?? null, file: legacyFile, cache: "LEGACY_HIT", attempts: 0, sourceDrift: false };
    }
  }
  let lastError;
  for (let attempt = 0; attempt <= runtime.retries; attempt += 1) {
    if (attempt) {
      runtime.accounting.retryAttempts += 1;
      await runtime.delayImpl(Math.min(30_000, runtime.retryBaseMs * (2 ** (attempt - 1))));
    }
    try {
      const result = await runtime.schedule(() => requestSourceBytes(url, { fetchImpl: runtime.fetchImpl, timeoutMs: runtime.timeoutMs, retries: 0, allowedHost: (host) => host === METADATA_HOST }));
      runtime.accounting.networkRequests += 1;
      let payload;
      try { payload = JSON.parse(result.bytes.toString("utf8")); }
      catch { throw discoveryError("DISCOVERY_RESPONSE_JSON_INVALID", url); }
      try { validate(payload); }
      catch (error) {
        if (error?.code === "DISCOVERY_ARTIST_NOT_FOUND") await writeDiscoveryCache(runtime.cacheRoot, source, key, url, result.bytes, runtime.now().toISOString());
        throw error;
      }
      const cached = await writeDiscoveryCache(runtime.cacheRoot, source, key, url, result.bytes, runtime.now().toISOString());
      const sourceDrift = Boolean(current && current.responseSha256 !== cached.responseSha256);
      if (sourceDrift) runtime.accounting.sourceDrift += 1;
      return { payload, responseSha256: cached.responseSha256, recordedAt: runtime.now().toISOString(), file: cached.file, cache: current ? "REFRESHED" : "MISS", attempts: attempt + 1, sourceDrift, http: result.accounting };
    } catch (error) {
      runtime.accounting.networkRequests += error?.code?.startsWith("ACQUISITION_") ? 1 : 0;
      lastError = error;
      if (!retryableStatus(error) || attempt >= runtime.retries) break;
    }
  }
  if (Number(lastError?.status) === 429) throw discoveryError("DISCOVERY_THROTTLED", `${source}/${key}`, { cause: lastError });
  if ([401, 403].includes(Number(lastError?.status))) throw discoveryError("DISCOVERY_ACCESS_RESTRICTED", `${source}/${key}`, { cause: lastError });
  throw lastError;
}

function validateArtistPage(payload, artistId) {
  if (Number(payload?.code) === 404 && payload?.artist == null && payload?.hotAlbums == null) throw discoveryError("DISCOVERY_ARTIST_NOT_FOUND", artistId);
  if (Number(payload?.code) !== 200 || !Array.isArray(payload?.hotAlbums) || typeof payload?.more !== "boolean") throw discoveryError("MALFORMED_ARTIST_DISCOGRAPHY_PAGE", artistId);
  const returnedId = decimalId(payload?.artist?.id);
  if (returnedId && returnedId !== artistId) throw discoveryError("ARTIST_DISCOVERY_IDENTITY_MISMATCH", `${artistId} != ${returnedId}`);
}

function validateNewAlbumsPage(payload) {
  if (Number(payload?.code) !== 200 || !Array.isArray(payload?.albums) || !Number.isInteger(Number(payload?.total)) || Number(payload.total) < 0) {
    throw discoveryError("MALFORMED_PUBLIC_NEW_ALBUMS_PAGE", "Expected code=200, albums[], and non-negative total.");
  }
}

async function enumerateArtist(runtime, seed, { pageSize, maximumPages, legacyCacheRoot }) {
  const records = [];
  const pages = [];
  for (let page = 0; page < maximumPages; page += 1) {
    const offset = page * pageSize;
    const key = `artist-${seed.neteaseArtistId}-offset-${offset}-limit-${pageSize}`;
    const url = `https://${METADATA_HOST}/api/artist/albums/${encodeURIComponent(seed.neteaseArtistId)}?limit=${pageSize}&offset=${offset}`;
    const legacyFile = legacyCacheRoot ? path.join(legacyCacheRoot, `artist-albums-${seed.neteaseArtistId}-${offset}.json`) : null;
    const response = await requestDiscoveryPage({ runtime, source: "current-artists", key, url, legacyFile, validate: (payload) => validateArtistPage(payload, seed.neteaseArtistId) });
    const source = { kind: "current-artists", artistId: seed.neteaseArtistId, artistName: seed.name, reference: url };
    const pageRecords = response.payload.hotAlbums.map((album) => normalizeDiscoveryAlbum(album, source));
    pages.push({ key, offset, records: pageRecords.length, cache: response.cache, responseSha256: response.responseSha256, contentFingerprint: fingerprint(pageRecords), sourceDrift: response.sourceDrift });
    records.push(...pageRecords);
    if (!response.payload.more) return { records, pages, exhausted: true };
    if (!pageRecords.length) throw discoveryError("ARTIST_PAGINATION_STALLED", seed.neteaseArtistId);
  }
  throw discoveryError("ARTIST_PAGINATION_SAFETY_LIMIT", `${seed.neteaseArtistId} exceeded ${maximumPages} pages.`);
}

async function enumerateCurrentArtists(runtime, seeds, options) {
  const results = new Array(seeds.length);
  const failures = [];
  let cursor = 0;
  let attempted = 0;
  let halted = false;
  async function worker() {
    while (!halted && cursor < seeds.length) {
      const index = cursor++;
      const seed = seeds[index];
      attempted += 1;
      try { results[index] = { seed, ...(await enumerateArtist(runtime, seed, options)) }; }
      catch (error) {
        failures.push({ source: "current-artists", artistId: seed.neteaseArtistId, artistName: seed.name, code: error.code ?? "DISCOVERY_SOURCE_FAILED", message: String(error.message) });
        if (["DISCOVERY_THROTTLED", "DISCOVERY_ACCESS_RESTRICTED"].includes(error.code)) halted = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, seeds.length || 1) }, worker));
  const completed = results.filter(Boolean);
  return {
    records: completed.flatMap((result) => result.records),
    failures,
    summary: {
      source: "current-artists",
      artistsAvailable: seeds.length,
      artistsAttempted: attempted,
      artistsSucceeded: completed.length,
      artistsFailed: failures.length,
      pages: completed.reduce((sum, result) => sum + result.pages.length, 0),
      albumRecords: completed.reduce((sum, result) => sum + result.records.length, 0),
      halted,
      artists: completed.map((result) => ({ artistId: result.seed.neteaseArtistId, artistName: result.seed.name, pages: result.pages.length, albumRecords: result.records.length, uniqueAlbumIds: new Set(result.records.map((record) => record.neteaseAlbumId)).size })),
      pageEvidence: completed.flatMap((result) => result.pages),
    },
  };
}

async function enumeratePublicNewAlbums(runtime, { pageSize = 50, maximumPages = 20 } = {}) {
  const records = [];
  const pages = [];
  try {
    for (let page = 0; page < maximumPages; page += 1) {
      const offset = page * pageSize;
      const key = `area-all-offset-${offset}-limit-${pageSize}`;
      const url = `https://${METADATA_HOST}/api/album/new?area=ALL&limit=${pageSize}&offset=${offset}`;
      const response = await requestDiscoveryPage({ runtime, source: "public-new-albums", key, url, validate: validateNewAlbumsPage });
      const source = { kind: "public-new-albums", marketChannel: "ALL", reference: url };
      const pageRecords = response.payload.albums.map((album) => normalizeDiscoveryAlbum(album, source));
      pages.push({ key, offset, records: pageRecords.length, total: Number(response.payload.total), cache: response.cache, responseSha256: response.responseSha256, contentFingerprint: fingerprint(pageRecords), sourceDrift: response.sourceDrift });
      records.push(...pageRecords);
      if (offset + pageRecords.length >= Number(response.payload.total)) return { records, failures: [], summary: { source: "public-new-albums", marketChannel: "ALL", pages: pages.length, albumRecords: records.length, totalReported: Number(response.payload.total), pageEvidence: pages } };
      if (!pageRecords.length) throw discoveryError("PUBLIC_NEW_ALBUMS_PAGINATION_STALLED", String(offset));
    }
    throw discoveryError("PUBLIC_NEW_ALBUMS_SAFETY_LIMIT", String(maximumPages));
  } catch (error) {
    return { records, failures: [{ source: "public-new-albums", code: error.code ?? "DISCOVERY_SOURCE_FAILED", message: String(error.message) }], summary: { source: "public-new-albums", marketChannel: "ALL", pages: pages.length, albumRecords: records.length, pageEvidence: pages, failed: true } };
  }
}

function sourceKey(source) {
  return `${source.kind}:${source.artistId ?? ""}:${source.marketChannel ?? ""}:${source.reference}`;
}

function mergeDiscoveredRecords(records) {
  const ordered = [...records].sort((left, right) => SOURCE_PRIORITY[left.sources[0].kind] - SOURCE_PRIORITY[right.sources[0].kind] || left.neteaseAlbumId.localeCompare(right.neteaseAlbumId, "en-US", { numeric: true }));
  const merged = new Map();
  for (const record of ordered) {
    const existing = merged.get(record.neteaseAlbumId);
    if (!existing) { merged.set(record.neteaseAlbumId, { ...record, sources: [...record.sources] }); continue; }
    const known = new Set(existing.sources.map(sourceKey));
    for (const source of record.sources) if (!known.has(sourceKey(source))) existing.sources.push(source);
  }
  return [...merged.values()].map((record) => ({ ...record, sources: record.sources.sort((left, right) => SOURCE_PRIORITY[left.kind] - SOURCE_PRIORITY[right.kind] || sourceKey(left).localeCompare(sourceKey(right))) }));
}

export function parseDiscoveryTypes(value) {
  const types = value == null || value === "" ? [...DEFAULT_DISCOVERY_TYPES] : [...new Set(String(value).split(/[|,]/u).map((item) => item.trim().toLocaleLowerCase("en-US")).filter(Boolean))];
  const invalid = types.filter((type) => !DISCOVERY_TYPES.includes(type));
  if (!types.length || invalid.length) throw discoveryError("INVALID_DISCOVERY_TYPES", invalid.join(", ") || "No types selected.");
  return types.sort();
}

function candidateFingerprintPayload(value) {
  return {
    schema: DISCOVERY_CANDIDATE_SCHEMA,
    productionBaseline: value.productionBaseline,
    filters: value.filters,
    sourceContentFingerprints: value.sourceContentFingerprints,
    records: value.records.map((record) => ({
      album_id: record.album_id,
      expected_title: record.expected_title,
      expected_artists: record.expected_artists,
      core_genres: record.core_genres,
      contexts: record.contexts,
      source_reference: record.source_reference,
      manual_verified: record.manual_verified,
      discovery_album_type: record.discovery_album_type,
    })),
  };
}

export function validateDiscoveryCandidateArtifact(value) {
  if (!value || value.schema !== DISCOVERY_CANDIDATE_SCHEMA || !Array.isArray(value.records) || !value.productionBaseline?.catalogSha256) {
    throw discoveryError("INVALID_DISCOVERY_CANDIDATE_SCHEMA", `Expected ${DISCOVERY_CANDIDATE_SCHEMA}.`);
  }
  const actual = fingerprint(candidateFingerprintPayload(value));
  if (actual !== value.fingerprint) throw discoveryError("DISCOVERY_CANDIDATE_FINGERPRINT_MISMATCH", `${actual} != ${value.fingerprint}`);
  return value;
}

async function allocateRunRoot(discoveryRoot, now) {
  const stem = `DISCOVERY-RUN-${now.toISOString().replace(/[-:TZ.]/gu, "").slice(0, 17)}`;
  await mkdir(path.join(discoveryRoot, "runs"), { recursive: true });
  for (let index = 0; index < 1000; index += 1) {
    const runId = index ? `${stem}-${String(index).padStart(3, "0")}` : stem;
    const root = path.join(discoveryRoot, "runs", runId);
    try { await mkdir(root, { recursive: false }); return { runId, root }; }
    catch (error) { if (error?.code !== "EEXIST") throw error; }
  }
  throw discoveryError("DISCOVERY_RUN_ID_EXHAUSTED", stem);
}

export async function runDiscovery({
  catalogPath,
  artistIndexPath,
  workspaceRoot,
  legacyCacheRoot = null,
  limit = Infinity,
  artistLimit = Infinity,
  types = DEFAULT_DISCOVERY_TYPES,
  fromCurrentArtists = false,
  refresh = false,
  concurrency = 2,
  timeoutMs = 15_000,
  retries = 1,
  minimumGapMs = 2_000,
  maximumArtistPages = 100,
  fetchImpl = globalThis.fetch,
  delayImpl = sleep,
  now = () => new Date(),
} = {}) {
  if (!fetchImpl) throw discoveryError("FETCH_UNAVAILABLE", "Node fetch is unavailable.");
  const selectedTypes = parseDiscoveryTypes(Array.isArray(types) ? types.join(",") : types);
  const numericLimit = limit === Infinity ? Infinity : Number(limit);
  const numericArtistLimit = artistLimit === Infinity ? Infinity : Number(artistLimit);
  if (!(numericLimit === Infinity || Number.isInteger(numericLimit) && numericLimit > 0)) throw discoveryError("INVALID_DISCOVERY_LIMIT", String(limit));
  if (!(numericArtistLimit === Infinity || Number.isInteger(numericArtistLimit) && numericArtistLimit > 0)) throw discoveryError("INVALID_ARTIST_LIMIT", String(artistLimit));
  if (!Number.isInteger(Number(concurrency)) || Number(concurrency) < 1 || Number(concurrency) > 4) throw discoveryError("INVALID_CONCURRENCY", String(concurrency));
  const discoveryRoot = path.join(workspaceRoot, "discovery");
  const cacheRoot = path.join(discoveryRoot, "cache");
  const startedAt = now();
  const { runId, root: runRoot } = await allocateRunRoot(discoveryRoot, startedAt);
  const [catalogText, artistIndex] = await Promise.all([readFile(catalogPath, "utf8"), readJson(artistIndexPath)]);
  const catalog = JSON.parse(catalogText);
  const productionBaseline = { albums: catalog.albums.length, catalogSha256: sha256Bytes(catalogText), catalogFingerprint: fingerprint(catalog) };
  const invalidArtistSeeds = (artistIndex?.artists ?? []).filter((artist) => !decimalId(artist?.neteaseArtistId)).map((artist) => ({ neteaseArtistId: String(artist?.neteaseArtistId ?? ""), name: String(artist?.name ?? "") }));
  const artistSeeds = (artistIndex?.artists ?? []).filter((artist) => decimalId(artist?.neteaseArtistId)).map((artist) => ({ neteaseArtistId: decimalId(artist.neteaseArtistId), name: String(artist.name ?? "") })).slice(0, numericArtistLimit);
  const runtime = {
    cacheRoot,
    refresh: Boolean(refresh),
    fetchImpl,
    timeoutMs,
    retries,
    retryBaseMs: 2_000,
    delayImpl,
    now,
    schedule: null,
    accounting: { networkRequests: 0, cacheHits: 0, legacyCacheHits: 0, retryAttempts: 0, sourceDrift: 0 },
  };
  runtime.schedule = createRequestScheduler({ minimumGapMs, delayImpl });
  const currentArtists = await enumerateCurrentArtists(runtime, artistSeeds, { pageSize: 50, maximumPages: maximumArtistPages, legacyCacheRoot, concurrency: Number(concurrency) });
  const additional = fromCurrentArtists ? { records: [], failures: [], summary: { source: "public-new-albums", skipped: true, reason: "from-current-artists" } } : await enumeratePublicNewAlbums(runtime);
  const appearances = [...currentArtists.records, ...additional.records];
  const unique = mergeDiscoveredRecords(appearances);
  const existingIds = new Set(catalog.albums.map((album) => String(album.neteaseAlbumId)));
  const currentArtistIds = new Set(currentArtists.records.map((record) => record.neteaseAlbumId));
  const publicNewIds = new Set(additional.records.map((record) => record.neteaseAlbumId));
  Object.assign(currentArtists.summary, {
    uniqueAlbumIds: currentArtistIds.size,
    existingAlbumIds: [...currentArtistIds].filter((id) => existingIds.has(id)).length,
    newAlbumIds: [...currentArtistIds].filter((id) => !existingIds.has(id)).length,
  });
  if (!additional.summary.skipped) Object.assign(additional.summary, {
    uniqueAlbumIds: publicNewIds.size,
    existingAlbumIds: [...publicNewIds].filter((id) => existingIds.has(id)).length,
    newAlbumIds: [...publicNewIds].filter((id) => !existingIds.has(id)).length,
    outsideCurrentArtistDiscovery: [...publicNewIds].filter((id) => !currentArtistIds.has(id)).length,
  });
  const existing = unique.filter((record) => existingIds.has(record.neteaseAlbumId));
  const newRecords = unique.filter((record) => !existingIds.has(record.neteaseAlbumId));
  const eligible = newRecords.filter((record) => selectedTypes.includes(record.albumType)).sort((left, right) => SOURCE_PRIORITY[left.sources[0].kind] - SOURCE_PRIORITY[right.sources[0].kind] || left.neteaseAlbumId.localeCompare(right.neteaseAlbumId, "en-US", { numeric: true }));
  const selected = eligible.slice(0, numericLimit);
  const discoveredAt = startedAt.toISOString();
  const filters = { types: selectedTypes, limit: numericLimit === Infinity ? null : numericLimit, fromCurrentArtists: Boolean(fromCurrentArtists), artistLimit: numericArtistLimit === Infinity ? null : numericArtistLimit };
  const sourceContentFingerprints = [...currentArtists.summary.pageEvidence, ...(additional.summary.pageEvidence ?? [])].map((page) => ({ source: page.key.startsWith("artist-") ? "current-artists" : "public-new-albums", key: page.key, contentFingerprint: page.contentFingerprint })).sort((a, b) => `${a.source}:${a.key}`.localeCompare(`${b.source}:${b.key}`));
  const records = selected.map((record) => ({
    album_id: record.neteaseAlbumId,
    expected_title: record.title,
    expected_artists: record.artists.map((artist) => artist.name).join("|"),
    core_genres: "",
    contexts: "",
    source_reference: JSON.stringify({ sources: record.sources.map((source) => ({ kind: source.kind, artistId: source.artistId ?? null, marketChannel: source.marketChannel ?? null, reference: source.reference })) }),
    discovered_at: discoveredAt,
    manual_verified: "false",
    discovery_album_type: record.albumType,
  }));
  const candidate = { schema: DISCOVERY_CANDIDATE_SCHEMA, runId, generatedAt: discoveredAt, productionBaseline, filters, sourceContentFingerprints, taxonomy: { coreGenres: "REQUIRED_BEFORE_QUALIFIED_CANDIDATE", inferred: false }, assertions: { sourceDerived: true, humanVerified: false }, records };
  candidate.fingerprint = fingerprint(candidateFingerprintPayload(candidate));
  const failures = [...currentArtists.failures, ...additional.failures];
  const counts = {
    discovered: unique.length,
    sourceAppearances: appearances.length,
    duplicatesAcrossSources: appearances.length - unique.length,
    existing: existing.length,
    newBeforeTypeFilter: newRecords.length,
    excludedByType: newRecords.length - eligible.length,
    eligibleBeforeLimit: eligible.length,
    newCandidates: selected.length,
    truncatedByLimit: eligible.length - selected.length,
    failedSources: failures.length,
  };
  const snapshotCore = { schema: DISCOVERY_SNAPSHOT_SCHEMA, productionBaseline, filters, sourceContentFingerprints, discoveredIds: unique.map((record) => record.neteaseAlbumId).sort((a, b) => a.localeCompare(b, "en-US", { numeric: true })), existingIds: existing.map((record) => record.neteaseAlbumId).sort((a, b) => a.localeCompare(b, "en-US", { numeric: true })), outputIds: selected.map((record) => record.neteaseAlbumId), counts };
  const snapshot = {
    ...snapshotCore,
    runId,
    startedAt: discoveredAt,
    completedAt: now().toISOString(),
    fingerprint: fingerprint(snapshotCore),
    status: failures.length ? unique.length ? "DISCOVERY_COMPLETE_WITH_FAILURES" : "DISCOVERY_FAILED" : "DISCOVERY_COMPLETE",
    sources: [currentArtists.summary, additional.summary],
    invalidArtistSeeds,
    failures,
    network: { concurrency: Number(concurrency), timeoutMs, retryLimit: retries, minimumGapMs, ...runtime.accounting },
    candidate: { path: "discovered-albums.json", fingerprint: candidate.fingerprint, records: records.length },
    policy: { completeNeteaseDatabaseClaimed: false, sourceEnumerationOnly: true, defaultTypes: [...DEFAULT_DISCOVERY_TYPES], taxonomyInference: false },
  };
  const candidatePath = path.join(runRoot, "discovered-albums.json");
  const snapshotPath = path.join(runRoot, "snapshot.json");
  await Promise.all([writeFile(candidatePath, stableJson(candidate), "utf8"), writeFile(snapshotPath, stableJson(snapshot), "utf8")]);
  return { ...snapshot, paths: { runRoot, candidate: candidatePath, snapshot: snapshotPath }, candidateFingerprint: candidate.fingerprint };
}

export async function assertDiscoveryBaselineCurrent(file, catalogPath) {
  if (path.extname(file).toLocaleLowerCase("en-US") !== ".json") return null;
  const value = await readJson(file);
  if (value?.schema !== DISCOVERY_CANDIDATE_SCHEMA) return null;
  const candidate = validateDiscoveryCandidateArtifact(value);
  const actualCatalogSha256 = await sha256File(catalogPath);
  if (candidate.productionBaseline.catalogSha256 !== actualCatalogSha256) {
    throw discoveryError("STALE_DISCOVERY_BASELINE", `${candidate.productionBaseline.catalogSha256} != ${actualCatalogSha256}`);
  }
  return { runId: candidate.runId, fingerprint: candidate.fingerprint, baselineCatalogSha256: candidate.productionBaseline.catalogSha256, records: candidate.records.length };
}
