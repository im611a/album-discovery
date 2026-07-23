import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NETEASE_CATALOG_SEEDS } from "./netease-seeds.mjs";
import { CATALOG_TAXONOMY, descriptorTaxonomy } from "./taxonomy.mjs";
import { validateCatalogData } from "./catalog-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheDir = path.join(root, ".cache", "catalog", "netease");
const coverDir = path.join(root, "public", "catalog", "covers");
const outputDir = path.join(root, "src", "data", "generated");
const catalogPath = path.join(outputDir, "catalog.json");
const manifestPath = path.join(outputDir, "catalog.manifest.json");
const identitiesPath = path.join(root, "scripts", "catalog", "netease-identities.json");
const requestLogPath = path.join(cacheDir, "request-log.jsonl");
const baseUrl = "https://music.163.com";
const minimumGapMs = 2_000;
const requestTimeoutMs = 20_000;
const cacheEnabled = process.env.NETEASE_REFRESH_USE_CACHE !== "0";
const taxonomyLabels = new Map(CATALOG_TAXONOMY.map((item) => [item.key, `${item.labelZh} ${item.labelEn}`]));
const descriptorLabels = new Map(descriptorTaxonomy.map((item) => [item.key, item.label]));
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

function normalizeAlbum(seed, albumId, payload, cover, refreshedAt) {
  const album = payload?.album ?? {};
  const songs = asArray(payload?.songs ?? album?.songs);
  const artists = albumArtists(album)
    .filter((artist) => artist?.id != null && artist?.name)
    .map((artist) => ({ id: `netease-artist:${artist.id}`, neteaseArtistId: String(artist.id), name: String(artist.name) }));
  const identityTitle = normalize(album.name);
  const identityArtists = normalize(artists.map((artist) => artist.name).join(" "));
  if (identityTitle !== normalize(seed.query.title) || !(
    identityArtists.includes(normalize(seed.query.artist)) ||
    normalize(seed.query.artist).includes(identityArtists)
  )) {
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
    descriptors: seed.descriptors,
  } : null;
  const searchText = [
    album.name,
    ...aliases,
    ...artists.map((artist) => artist.name),
    ...seed.coreGenres,
    ...seed.coreGenres.map((item) => taxonomyLabels.get(item) ?? item),
    ...seed.relatedGenres,
    ...seed.relatedGenres.map((item) => taxonomyLabels.get(item) ?? item),
    ...seed.descriptors,
    ...seed.descriptors.map((item) => descriptorLabels.get(item) ?? item),
    ...seed.contexts,
  ].join(" ");
  return {
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
    discoveredAt: seed.sourceMarketChannels.length ? "2026-07-15T00:00:00.000Z" : "2026-07-23T00:00:00.000Z",
    updatedAt: refreshedAt,
    sourceMarketChannels: [...new Set(seed.sourceMarketChannels)],
    coreGenres: [...new Set(seed.coreGenres)],
    relatedGenres: [...new Set(seed.relatedGenres)],
    descriptors: [...new Set(seed.descriptors)],
    contexts: [...new Set(seed.contexts)],
    editorial,
    searchText,
  };
}

async function main() {
  await Promise.all([mkdir(cacheDir, { recursive: true }), mkdir(coverDir, { recursive: true }), mkdir(outputDir, { recursive: true })]);
  await writeFile(requestLogPath, "", "utf8");
  const previousIdentities = await readJson(identitiesPath, {});
  const nextIdentities = {};
  const refreshedAt = new Date().toISOString();
  const albums = [];
  for (const seed of NETEASE_CATALOG_SEEDS) {
    const albumId = await resolveAlbumId(seed, previousIdentities);
    const payload = await readAlbumDetail(albumId);
    const album = payload?.album ?? {};
    const cover = await ensureCover(albumId, album.picUrl ?? album.coverUrl);
    albums.push(normalizeAlbum(seed, albumId, payload, cover, refreshedAt));
    nextIdentities[seed.slug] = {
      albumId,
      title: seed.query.title,
      artist: seed.query.artist,
      fixedAt: previousIdentities[seed.slug]?.fixedAt ?? refreshedAt,
    };
    console.log(`[${albums.length}/${NETEASE_CATALOG_SEEDS.length}] ${albumId} ${album.name}`);
  }
  const catalog = {
    version: 2,
    refreshDate: refreshedAt.slice(0, 10),
    source: {
      catalog: "netease",
      endpointFamily: "anonymous-public-album-metadata",
      generatedAt: refreshedAt,
      runtimeRequestsAllowed: false,
    },
    taxonomy: CATALOG_TAXONOMY,
    descriptorTaxonomy,
    albums,
  };
  const validation = validateCatalogData(catalog, nextIdentities);
  if (!validation.ok) throw new Error(`Catalog validation failed:\n${validation.errors.join("\n")}`);
  const temporaryCatalog = `${catalogPath}.tmp`;
  const temporaryManifest = `${manifestPath}.tmp`;
  await writeFile(temporaryCatalog, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  await writeFile(temporaryManifest, `${JSON.stringify(validation.summary, null, 2)}\n`, "utf8");
  await writeFile(identitiesPath, `${JSON.stringify(nextIdentities, null, 2)}\n`, "utf8");
  await rename(temporaryCatalog, catalogPath);
  await rename(temporaryManifest, manifestPath);
  console.log(`Published ${albums.length} NetEase albums after ${requestCount} external requests.`);
}

await main();
