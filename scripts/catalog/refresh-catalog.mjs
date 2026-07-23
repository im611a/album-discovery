import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NETEASE_CATALOG_SEEDS } from "./netease-seeds.mjs";
import { MANUAL_CORE_TAXONOMY } from "./taxonomy.mjs";
import { resolveRymTaxonomy, validateRymTaxonomySnapshot } from "./rym-taxonomy.mjs";
import { validateCatalogData } from "./catalog-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = path.join(root, ".cache", "catalog", "netease");
const coverDir = path.join(root, "public", "catalog", "covers");
const outputDir = path.join(root, "src", "data", "generated");
const catalogPath = path.join(outputDir, "catalog.json");
const catalogIndexPath = path.join(outputDir, "catalog-index.json");
const manifestPath = path.join(outputDir, "catalog.manifest.json");
const identitiesPath = path.join(root, "scripts", "catalog", "netease-identities.json");
const rymTaxonomySnapshotPath = path.join(root, "scripts", "catalog", "rym-taxonomy-snapshot.json");
const rymTaxonomyAuditPath = path.join(root, "reports", "catalog", "rym-taxonomy-audit.json");
const refreshReportPath = path.join(root, "reports", "catalog", "refresh-report.json");
const requestLogPath = path.join(cacheDir, "request-log.jsonl");
const baseUrl = "https://music.163.com";
const minimumGapMs = 2_000;
const requestTimeoutMs = 20_000;
const cacheEnabled = process.env.NETEASE_REFRESH_USE_CACHE !== "0";
const prefetchOffset = Number(process.env.NETEASE_PREFETCH_OFFSET ?? "0");
const prefetchLimit = Number(process.env.NETEASE_PREFETCH_LIMIT ?? "0");
const parserVersion = "netease-catalog-v3";
let lastRequestCompletedAt = 0;
let requestCount = 0;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const asArray = (value) => (Array.isArray(value) ? value : []);
const normalize = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase("zh-CN")
  .replace(/[\p{P}\p{S}\s]+/gu, "");

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function waitForGap() {
  const remaining = minimumGapMs - (Date.now() - lastRequestCompletedAt);
  if (lastRequestCompletedAt && remaining > 0) await sleep(remaining);
}

function classifyRestriction(status, text, payload) {
  if ([401, 403, 429].includes(status)) return `http_${status}`;
  const code = Number(payload?.code);
  if ([301, 302, 401, 403, 429, -460].includes(code)) return `upstream_${code}`;
  if (/验证码|风控|captcha|risk.?control|login required/iu.test(text)) return "captcha_or_risk_control";
  return null;
}

async function logRequest(entry) {
  await appendFile(requestLogPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function requestJson({ endpoint, method = "GET", form = null, purpose }) {
  const url = new URL(endpoint, baseUrl);
  if (url.protocol !== "https:" || url.hostname !== "music.163.com") {
    throw new Error(`Blocked non-allowlisted metadata URL: ${url.href}`);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForGap();
    const requestedAt = new Date().toISOString();
    const startedAt = performance.now();
    requestCount += 1;
    let status = null;
    try {
      const response = await fetch(url, {
        method,
        body: form ? new URLSearchParams(form) : undefined,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      status = response.status;
      const text = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      const restriction = classifyRestriction(status, text, payload);
      const success = response.ok && payload && !restriction && [0, 200].includes(Number(payload.code ?? 200));
      await logRequest({
        purpose,
        endpoint: url.pathname,
        requestedAt,
        status,
        durationMs: Math.round(performance.now() - startedAt),
        success,
        errorCategory: success ? null : restriction ?? (payload ? `upstream_${payload.code ?? "unknown"}` : "invalid_json"),
      });
      lastRequestCompletedAt = Date.now();
      if (restriction) throw new Error(`NetEase access stopped by ${restriction}; no retry was attempted.`);
      if (success) return payload;
      if (status < 500 || attempt === 1) throw new Error(`NetEase request failed for ${url.pathname} (${status}).`);
    } catch (error) {
      lastRequestCompletedAt = Date.now();
      if (/access stopped|request failed/.test(String(error?.message))) throw error;
      await logRequest({
        purpose,
        endpoint: url.pathname,
        requestedAt,
        status,
        durationMs: Math.round(performance.now() - startedAt),
        success: false,
        errorCategory: error?.name === "TimeoutError" ? "timeout" : "network_error",
      });
      if (attempt === 1) throw error;
    }
  }
  throw new Error(`NetEase request failed for ${endpoint}.`);
}

function albumArtists(album) {
  return asArray(album?.artists ?? album?.ar ?? album?.artist);
}

function chooseSearchResult(seed, albums) {
  const expectedTitle = normalize(seed.query.title);
  const expectedArtist = normalize(seed.query.artist);
  return asArray(albums)
    .map((album) => {
      const title = normalize(album?.name);
      const artists = normalize(albumArtists(album).map((artist) => artist?.name).join(" "));
      let score = 0;
      if (title === expectedTitle) score += 20;
      else if (title.includes(expectedTitle) || expectedTitle.includes(title)) score += 5;
      if (artists === expectedArtist) score += 12;
      else if (artists.includes(expectedArtist) || expectedArtist.includes(artists)) score += 5;
      return { album, score };
    })
    .sort((left, right) => right.score - left.score)[0];
}

async function resolveAlbumId(seed, identities) {
  if (seed.albumId) return seed.albumId;
  if (identities[seed.slug]?.albumId) return identities[seed.slug].albumId;
  const cachePath = path.join(cacheDir, `search-${seed.slug}.json`);
  let payload = cacheEnabled ? await readJson(cachePath, null) : null;
  if (!payload) {
    payload = await requestJson({
      purpose: `search:${seed.slug}`,
      endpoint: "/api/search/get",
      method: "POST",
      form: { s: `${seed.query.artist} ${seed.query.title}`, type: "10", limit: "20", offset: "0" },
    });
    await writeFile(cachePath, `${JSON.stringify(payload)}\n`, "utf8");
  }
  const selected = chooseSearchResult(seed, payload?.result?.albums ?? payload?.albums);
  if (!selected || selected.score < 25 || selected.album?.id == null) {
    throw new Error(`No confident NetEase album match for ${seed.query.artist} / ${seed.query.title}.`);
  }
  return String(selected.album.id);
}

async function readAlbumDetail(albumId) {
  const cachePath = path.join(cacheDir, `album-${albumId}.json`);
  let payload = cacheEnabled ? await readJson(cachePath, null) : null;
  if (!payload) {
    payload = await requestJson({
      purpose: `album-detail:${albumId}`,
      endpoint: `/api/v1/album/${encodeURIComponent(albumId)}`,
    });
    await writeFile(cachePath, `${JSON.stringify(payload)}\n`, "utf8");
  }
  return payload;
}

function normalizeCoverUrl(value) {
  if (!value) return null;
  const url = new URL(String(value).replace(/^http:/, "https:"));
  if (url.protocol !== "https:" || !(url.hostname === "music.163.com" || url.hostname.endsWith(".music.126.net"))) {
    return null;
  }
  return url;
}

async function ensureCover(albumId, sourceUrl) {
  const destination = path.join(coverDir, `${albumId}.jpg`);
  try {
    const existing = await stat(destination);
    if (existing.size > 1_000) return { ok: true, src: `/catalog/covers/${albumId}.jpg` };
  } catch {
    // Download below.
  }
  const url = normalizeCoverUrl(sourceUrl);
  if (!url) return { ok: false, reason: "upstream_cover_missing" };
  await waitForGap();
  const requestedAt = new Date().toISOString();
  const startedAt = performance.now();
  try {
    requestCount += 1;
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
    const restriction = [401, 403, 429].includes(response.status) ? `http_${response.status}` : null;
    if (restriction) throw new Error(`cover_${restriction}`);
    if (!response.ok) throw new Error(`cover_http_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_000) throw new Error("cover_too_small");
    await writeFile(destination, bytes);
    await logRequest({
      purpose: `cover:${albumId}`,
      endpoint: url.hostname,
      requestedAt,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      success: true,
      errorCategory: null,
    });
    lastRequestCompletedAt = Date.now();
    return { ok: true, src: `/catalog/covers/${albumId}.jpg` };
  } catch (error) {
    await logRequest({
      purpose: `cover:${albumId}`,
      endpoint: url.hostname,
      requestedAt,
      status: null,
      durationMs: Math.round(performance.now() - startedAt),
      success: false,
      errorCategory: String(error?.message ?? "cover_download_failed"),
    });
    lastRequestCompletedAt = Date.now();
    return { ok: false, reason: "cover_download_failed" };
  }
}

function releaseDateFromTimestamp(value) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) return { releaseDate: null, releaseDatePrecision: null };
  return { releaseDate: date.toISOString().slice(0, 10), releaseDatePrecision: "day" };
}

function releaseType(value) {
  const normalized = String(value ?? "").toLocaleLowerCase("en-US");
  if (normalized === "ep") return "ep";
  if (normalized === "single") return "single";
  if (normalized.includes("mixtape")) return "mixtape";
  if (normalized.includes("soundtrack") || normalized.includes("原声")) return "soundtrack";
  if (normalized.includes("live") || normalized.includes("现场")) return "live";
  if (normalized.includes("compilation") || normalized.includes("精选")) return "compilation";
  return "album";
}

function parseDiscNumber(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function normalizeAlbum(seed, albumId, payload, cover, refreshedAt, rymRecords) {
  const album = payload?.album ?? {};
  const songs = asArray(payload?.songs ?? album?.songs);
  const artists = albumArtists(album)
    .filter((artist) => artist?.id != null && artist?.name)
    .map((artist) => ({ id: `netease-artist:${artist.id}`, neteaseArtistId: String(artist.id), name: String(artist.name) }));
  const identityTitle = normalize(album.name);
  const identityArtists = normalize(artists.map((artist) => artist.name).join(" "));
  const artistIdentityMatches = seed.verification?.artistId
    ? artists.some((artist) => artist.neteaseArtistId === seed.verification.artistId)
    : identityArtists.includes(normalize(seed.query.artist)) || normalize(seed.query.artist).includes(identityArtists);
  if (identityTitle !== normalize(seed.query.title) || !artistIdentityMatches) {
    throw new Error(`Fixed NetEase identity mismatch for ${seed.slug}: received ${album.name} / ${artists.map((artist) => artist.name).join(", ")}.`);
  }
  const dates = releaseDateFromTimestamp(album.publishTime ?? album.releaseDate);
  const tracks = songs.map((song, index) => {
    const trackArtists = asArray(song?.ar ?? song?.artists).map((artist) => String(artist?.name ?? "")).filter(Boolean);
    return {
      id: `netease-track:${song?.id ?? `${albumId}-${index + 1}`}`,
      neteaseTrackId: song?.id == null ? null : String(song.id),
      title: String(song?.name ?? `曲目 ${index + 1}`),
      trackNumber: Number.isFinite(Number(song?.no ?? song?.trackNumber)) ? Number(song?.no ?? song?.trackNumber) : index + 1,
      discNumber: parseDiscNumber(song?.cd ?? song?.disc),
      artists: trackArtists,
      durationMs: Number.isFinite(Number(song?.dt ?? song?.duration)) ? Number(song?.dt ?? song?.duration) : null,
    };
  });
  const aliases = [...new Set(asArray(album.alias ?? album.aliases ?? album.transNames).map(String).map((item) => item.trim()).filter(Boolean))];
  const externalUrl = `https://music.163.com/#/album?id=${albumId}`;
  const editorial = seed.guide ? {
    ...seed.guide,
    bestFor: seed.contexts,
    startWithTrackId: tracks[0]?.id ?? null,
  } : null;
  const baseAlbum = {
    internalId: `album:${albumId}`,
    id: `album:${albumId}`,
    neteaseAlbumId: albumId,
    slug: seed.slug,
    title: String(album.name),
    aliases,
    artists,
    releaseDate: dates.releaseDate,
    releaseDatePrecision: dates.releaseDatePrecision,
    albumType: releaseType(album.type ?? album.subType),
    company: typeof album.company === "string" && album.company.trim() ? album.company.trim() : null,
    cover: cover.ok
      ? { kind: "local", src: cover.src, alt: `《${album.name}》专辑封面`, reason: null }
      : { kind: "fallback", src: null, alt: `《${album.name}》封面暂缺`, reason: cover.reason },
    tracks,
    trackCount: Number.isFinite(Number(album.size ?? album.trackCount)) ? Number(album.size ?? album.trackCount) : tracks.length,
    externalUrl,
    discoveredAt: seed.discoveredAt,
    updatedAt: refreshedAt,
    source: {
      catalog: "netease",
      fetchedAt: refreshedAt,
      parserVersion,
      verificationMethod: seed.verification?.method ?? "fixed_album_identity",
      error: null,
    },
    sourceMarketChannels: [...new Set(seed.sourceMarketChannels)],
    contexts: [...new Set(seed.contexts)],
    editorial,
  };
  if (!seed.coreGenres.length) {
    throw new Error(`Missing reviewed core genre for ${seed.slug}.`);
  }
  if (seed.verification) {
    if (dates.releaseDate?.slice(0, 4) !== seed.verification.expectedReleaseYear) {
      throw new Error(`Artist directory year mismatch for ${seed.slug}.`);
    }
    if (baseAlbum.albumType !== seed.verification.expectedAlbumType) {
      throw new Error(`Artist directory type mismatch for ${seed.slug}.`);
    }
    if (tracks.length !== seed.verification.expectedTrackCount) {
      throw new Error(`Artist directory track count mismatch for ${seed.slug}: ${tracks.length} !== ${seed.verification.expectedTrackCount}.`);
    }
  }
  if (!["album", "ep", "mixtape", "soundtrack"].includes(baseAlbum.albumType) || tracks.length < 2) {
    throw new Error(`Unsupported catalog release for ${seed.slug}: ${baseAlbum.albumType} / ${tracks.length} tracks.`);
  }
  const resolved = resolveRymTaxonomy(baseAlbum, seed.coreGenres, rymRecords);
  const searchText = [
    album.name,
    ...aliases,
    ...artists.map((artist) => artist.name),
  ].join(" ");
  return {
    album: { ...baseAlbum, ...resolved.taxonomy, searchText },
    audit: resolved.audit,
    terms: resolved.terms,
  };
}

async function main() {
  await Promise.all([
    mkdir(cacheDir, { recursive: true }),
    mkdir(coverDir, { recursive: true }),
    mkdir(outputDir, { recursive: true }),
    mkdir(path.dirname(rymTaxonomyAuditPath), { recursive: true }),
  ]);
  await writeFile(requestLogPath, "", "utf8");
  const previousIdentities = await readJson(identitiesPath, {});
  const rymSnapshot = await readJson(rymTaxonomySnapshotPath, null);
  const rymSnapshotErrors = validateRymTaxonomySnapshot(rymSnapshot);
  if (rymSnapshotErrors.length) throw new Error(`Invalid offline RYM taxonomy snapshot:\n${rymSnapshotErrors.join("\n")}`);
  const nextIdentities = {};
  const refreshedAt = new Date().toISOString();
  const albums = [];
  const taxonomyAudits = [];
  const matchedPrimaryTerms = [];
  const matchedSecondaryTerms = [];
  const matchedDescriptorTerms = [];
  const failures = [];
  const seeds = prefetchLimit > 0
    ? NETEASE_CATALOG_SEEDS.slice(prefetchOffset, prefetchOffset + prefetchLimit)
    : NETEASE_CATALOG_SEEDS;
  for (const [index, seed] of seeds.entries()) {
    try {
      const albumId = await resolveAlbumId(seed, previousIdentities);
      const payload = await readAlbumDetail(albumId);
      const album = payload?.album ?? {};
      const cover = await ensureCover(albumId, album.picUrl ?? album.coverUrl);
      const normalized = normalizeAlbum(seed, albumId, payload, cover, refreshedAt, rymSnapshot.records);
      albums.push(normalized.album);
      taxonomyAudits.push(normalized.audit);
      matchedPrimaryTerms.push(...normalized.terms.primary);
      matchedSecondaryTerms.push(...normalized.terms.secondary);
      matchedDescriptorTerms.push(...normalized.terms.descriptors);
      nextIdentities[seed.slug] = {
        albumId,
        title: seed.query.title,
        artist: normalized.album.artists[0]?.name ?? seed.query.artist,
        fixedAt: previousIdentities[seed.slug]?.fixedAt ?? refreshedAt,
      };
      console.log(`[${prefetchOffset + index + 1}/${NETEASE_CATALOG_SEEDS.length}] ${albumId} ${album.name}`);
    } catch (error) {
      failures.push({
        slug: seed.slug,
        albumId: seed.albumId,
        errorCategory: String(error?.message ?? "unknown"),
      });
      console.error(`[rejected] ${seed.slug}: ${String(error?.message ?? "unknown")}`);
    }
  }
  if (prefetchLimit > 0) {
    console.log(`Prefetched ${albums.length}/${seeds.length} records with ${failures.length} rejection(s) and ${requestCount} external requests.`);
    return;
  }
  if (albums.length < 300) throw new Error(`Catalog floor not met after validation: ${albums.length} < 300.`);
  const uniqueTerms = (terms) => [...new Map(terms.map((term) => [term.key, term])).values()];
  const usedCoreKeys = new Set(albums.flatMap((album) => album.coreGenres));
  const usedRelatedKeys = new Set(albums.flatMap((album) => album.relatedGenres));
  const rymPrimary = uniqueTerms(matchedPrimaryTerms).map((term) => ({ ...term, kind: "core" }));
  const rymPrimaryKeys = new Set(rymPrimary.map((term) => term.key));
  const taxonomy = uniqueTerms([
    ...MANUAL_CORE_TAXONOMY.filter((term) => usedCoreKeys.has(term.key)),
    ...rymPrimary,
    ...uniqueTerms(matchedSecondaryTerms)
      .filter((term) => usedRelatedKeys.has(term.key) && !rymPrimaryKeys.has(term.key))
      .map((term) => ({ ...term, kind: "related" })),
  ]);
  const descriptorTaxonomy = uniqueTerms(matchedDescriptorTerms)
    .filter((term) => albums.some((item) => item.descriptors.includes(term.key)))
    .map((term) => ({ ...term, kind: "descriptor" }));
  const catalog = {
    version: 2,
    refreshDate: refreshedAt.slice(0, 10),
    source: {
      catalog: "netease",
      endpointFamily: "anonymous-public-album-metadata",
      generatedAt: refreshedAt,
      parserVersion,
      runtimeRequestsAllowed: false,
      taxonomy: "rym-offline-or-manual-core",
    },
    taxonomy,
    descriptorTaxonomy,
    albums,
  };
  const validation = validateCatalogData(catalog, nextIdentities, rymSnapshot);
  if (!validation.ok) throw new Error(`Catalog validation failed:\n${validation.errors.join("\n")}`);
  const temporaryCatalog = `${catalogPath}.tmp`;
  const temporaryCatalogIndex = `${catalogIndexPath}.tmp`;
  const temporaryManifest = `${manifestPath}.tmp`;
  const indexAlbums = catalog.albums.map((album) => {
    const summary = { ...album };
    delete summary.tracks;
    return summary;
  });
  const catalogIndex = {
    ...catalog,
    albums: indexAlbums,
  };
  await writeFile(temporaryCatalog, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  await writeFile(temporaryCatalogIndex, `${JSON.stringify(catalogIndex, null, 2)}\n`, "utf8");
  await writeFile(temporaryManifest, `${JSON.stringify(validation.summary, null, 2)}\n`, "utf8");
  await writeFile(identitiesPath, `${JSON.stringify(nextIdentities, null, 2)}\n`, "utf8");
  await writeFile(rymTaxonomyAuditPath, `${JSON.stringify({
    generatedAt: refreshedAt,
    sourceDescription: rymSnapshot.sourceDescription,
    importedAt: rymSnapshot.importedAt,
    matched: taxonomyAudits.filter((item) => item.status === "matched").length,
    unmatched: taxonomyAudits.filter((item) => item.status === "unmatched").length,
    ambiguous: taxonomyAudits.filter((item) => item.status === "ambiguous").length,
    albums: taxonomyAudits,
  }, null, 2)}\n`, "utf8");
  await writeFile(refreshReportPath, `${JSON.stringify({
    refreshDate: catalog.refreshDate,
    ...validation.summary,
    rymMatched: taxonomyAudits.filter((item) => item.status === "matched").length,
    rymUnmatched: taxonomyAudits.filter((item) => item.status === "unmatched").length,
    rymAmbiguous: taxonomyAudits.filter((item) => item.status === "ambiguous").length,
    rejected: failures,
  }, null, 2)}\n`, "utf8");
  await rename(temporaryCatalog, catalogPath);
  await rename(temporaryCatalogIndex, catalogIndexPath);
  await rename(temporaryManifest, manifestPath);
  console.log(`Published ${albums.length} NetEase albums after ${requestCount} external requests.`);
}

await main();
