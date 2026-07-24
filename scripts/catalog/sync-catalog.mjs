import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { validateCatalogData } from "./catalog-validation.mjs";
import { normalizeListeningScenes } from "./listening-scenes.mjs";
import { publishCatalog } from "./publish-catalog.mjs";
import { runCatalogSync } from "./sync-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cacheRoot = path.join(root, ".cache", "catalog", "sync");
const rawCache = path.join(cacheRoot, "raw");
const checkpointPath = path.join(cacheRoot, "checkpoint.json");
const failureLogPath = path.join(cacheRoot, "failures.jsonl");
const summaryPath = path.join(cacheRoot, "last-summary.json");
const catalogPath = path.join(root, "src", "data", "generated", "catalog.json");
const identitiesPath = path.join(root, "scripts", "catalog", "netease-identities.json");
const rymSnapshotPath = path.join(root, "scripts", "catalog", "rym-taxonomy-snapshot.json");
const defaultSeedsPath = path.join(root, "scripts", "catalog", "sync-seeds.json");
const minimumGapMs = 2_000;
const timeoutMs = 20_000;
let lastRequestAt = 0;
const runFile = promisify(execFile);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const readJson = async (file, fallback = null) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

function parseArguments(argv) {
  const options = { dryRun: false, resume: false, limit: Infinity, seed: defaultSeedsPath };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--dry-run") options.dryRun = true;
    else if (value === "--resume") options.resume = true;
    else if (value === "--limit") options.limit = Number(argv[++index]);
    else if (value === "--seed") options.seed = path.resolve(argv[++index]);
    else throw new Error(`Unknown catalog sync option: ${value}`);
  }
  if (!(options.limit === Infinity || Number.isInteger(options.limit) && options.limit > 0)) {
    throw new Error("--limit must be a positive integer.");
  }
  return options;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers = [], ...values] = rows;
  return values.map((items) => Object.fromEntries(headers.map((header, index) => [header.trim(), items[index]?.trim() ?? ""])));
}

async function loadSeeds(file) {
  const text = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
  if (file.toLocaleLowerCase("en-US").endsWith(".csv")) {
    const rows = parseCsv(text);
    return {
      albums: rows.filter((row) => row.albumId || row.neteaseAlbumId).map((row) => ({
        albumId: row.albumId ?? row.neteaseAlbumId,
        coreGenres: String(row.coreGenres ?? "").split("|").filter(Boolean),
        contexts: String(row.contexts ?? row.listeningScenes ?? "").split("|").filter(Boolean),
        refresh: row.refresh === "true",
      })),
      artists: rows.filter((row) => row.artistId || row.neteaseArtistId).map((row) => ({
        artistId: row.artistId ?? row.neteaseArtistId,
        coreGenres: String(row.coreGenres ?? "").split("|").filter(Boolean),
        contexts: String(row.contexts ?? row.listeningScenes ?? "").split("|").filter(Boolean),
        maxAlbums: Number(row.maxAlbums || 10),
      })),
    };
  }
  const input = JSON.parse(text);
  if (!Array.isArray(input.albums)) throw new Error("JSON seed file must contain an albums array.");
  return { albums: input.albums, artists: Array.isArray(input.artists) ? input.artists : [] };
}

async function requestJson(albumId) {
  const remaining = minimumGapMs - (Date.now() - lastRequestAt);
  if (remaining > 0) await sleep(remaining);
  const url = new URL(`/api/v1/album/${encodeURIComponent(albumId)}`, "https://music.163.com");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      lastRequestAt = Date.now();
      if ([401, 403, 429].includes(response.status)) {
        const error = new Error(`NetEase access stopped by HTTP ${response.status}.`);
        error.code = `http_${response.status}`;
        throw error;
      }
      if (!response.ok) throw new Error(`NetEase album request failed with HTTP ${response.status}.`);
      const payload = await response.json();
      if (!payload?.album) throw new Error("NetEase response does not contain an album.");
      return payload;
    } catch (error) {
      if (error?.code || attempt === 1) throw error;
      await sleep(1_000 * (2 ** attempt));
    }
  }
}

async function requestArtistAlbums(artistId) {
  const url = new URL(`/api/artist/albums/${encodeURIComponent(artistId)}?limit=50&offset=0`, "https://music.163.com");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = minimumGapMs - (Date.now() - lastRequestAt);
    if (remaining > 0) await sleep(remaining);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      lastRequestAt = Date.now();
      if ([401, 403, 429].includes(response.status)) {
        const error = new Error(`NetEase artist discovery stopped by HTTP ${response.status}.`);
        error.code = `http_${response.status}`;
        throw error;
      }
      if (!response.ok) throw new Error(`NetEase artist discovery failed with HTTP ${response.status}.`);
      return response.json();
    } catch (error) {
      if (error?.code || attempt === 1) throw error;
      await sleep(1_000 * (2 ** attempt));
    }
  }
  throw new Error("NetEase artist discovery exhausted its retry limit.");
}

async function expandArtistSeeds(input) {
  const albums = [...input.albums];
  for (const seed of input.artists) {
    const artistId = String(seed?.artistId ?? "").trim();
    if (!/^\d+$/.test(artistId)) continue;
    const file = path.join(rawCache, `artist-${artistId}.json`);
    let payload = await readJson(file);
    if (!payload) {
      payload = await requestArtistAlbums(artistId);
      await writeFile(file, `${JSON.stringify(payload)}\n`, "utf8");
    }
    for (const album of (payload.hotAlbums ?? payload.albums ?? []).slice(0, Number(seed.maxAlbums ?? 10))) {
      if (album?.id == null) continue;
      albums.push({
        albumId: String(album.id),
        coreGenres: seed.coreGenres,
        contexts: seed.contexts,
        discoveredAt: seed.discoveredAt,
      });
    }
  }
  return albums;
}

async function ensureLocalCover(albumId, sourceValue) {
  const destination = path.join(root, "public", "catalog", "covers", `${albumId}.jpg`);
  try {
    const existing = await stat(destination);
    if (existing.size >= 1_000) return destination;
  } catch {
    // Download the reviewed public cover below.
  }
  const url = new URL(String(sourceValue ?? "").replace(/^http:/, "https:"));
  if (url.protocol !== "https:" || !(url.hostname === "music.163.com" || url.hostname.endsWith(".music.126.net"))) {
    const error = new Error("Album rejected because the cover URL is missing or outside the allowlist.");
    error.code = "invalid_cover_url";
    throw error;
  }
  const remaining = minimumGapMs - (Date.now() - lastRequestAt);
  if (remaining > 0) await sleep(remaining);
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  lastRequestAt = Date.now();
  if ([401, 403, 429].includes(response.status)) {
    const error = new Error(`Cover access stopped by HTTP ${response.status}.`);
    error.code = `cover_http_${response.status}`;
    throw error;
  }
  if (!response.ok || !String(response.headers.get("content-type") ?? "").startsWith("image/")) {
    const error = new Error(`Cover download rejected with HTTP ${response.status}.`);
    error.code = "cover_download_failed";
    throw error;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000) {
    const error = new Error("Cover download is too small to be a valid image.");
    error.code = "cover_too_small";
    throw error;
  }
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
  return destination;
}

async function ensureOptimizedCovers(albumId) {
  const source = path.join(root, "public", "catalog", "covers", `${albumId}.jpg`);
  const targets = [
    { directory: "thumb", width: 360, quality: 76 },
    { directory: "detail", width: 1200, quality: 82 },
  ];
  for (const target of targets) {
    const directory = path.join(root, "public", "catalog", "covers", target.directory);
    const destination = path.join(directory, `${albumId}.webp`);
    try {
      const existing = await stat(destination);
      if (existing.size >= 1_000) continue;
    } catch {
      // Generate the missing reviewed local derivative below.
    }
    await mkdir(directory, { recursive: true });
    const temporary = `${destination}.tmp.webp`;
    await runFile("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", source,
      "-vf", `scale='min(${target.width},iw)':-2`,
      "-c:v", "libwebp", "-quality", String(target.quality), temporary,
    ], { windowsHide: true });
    const generated = await stat(temporary);
    if (generated.size < 1_000) throw new Error(`Optimized cover ${target.directory}/${albumId}.webp is unexpectedly small.`);
    await rename(temporary, destination);
  }
}

function safeSlug(value, albumId) {
  const slug = String(value ?? "").normalize("NFKD").toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "");
  return slug && /^[a-z0-9-]+$/.test(slug) ? slug : `netease-album-${albumId}`;
}

function normalizePayload(seed, payload, fetchedAt, coverAvailable) {
  const source = payload.album;
  const songs = Array.isArray(payload.songs) ? payload.songs : Array.isArray(source.songs) ? source.songs : [];
  if (songs.length < 2) {
    const error = new Error("Album rejected because a complete multi-track list is unavailable.");
    error.code = "invalid_track_list";
    throw error;
  }
  if (!Array.isArray(seed.coreGenres) || !seed.coreGenres.length) {
    const error = new Error("Album rejected because no reviewed core genre was supplied.");
    error.code = "missing_reviewed_core_genre";
    throw error;
  }
  const artists = (source.artists ?? source.ar ?? []).filter((artist) => artist?.id != null && artist?.name).map((artist) => ({
    id: `netease-artist:${artist.id}`,
    neteaseArtistId: String(artist.id),
    name: String(artist.name),
  }));
  if (!artists.length) {
    const error = new Error("Album rejected because artist identity is missing.");
    error.code = "missing_artist";
    throw error;
  }
  const published = new Date(Number(source.publishTime ?? source.releaseDate));
  const releaseDate = Number.isFinite(published.getTime()) ? published.toISOString().slice(0, 10) : null;
  const typeValue = String(source.type ?? source.subType ?? "").toLocaleLowerCase("en-US");
  const albumType = typeValue === "ep" ? "ep" : typeValue.includes("mixtape") ? "mixtape" : typeValue.includes("soundtrack") || typeValue.includes("原声") ? "soundtrack" : "album";
  const albumId = String(source.id ?? seed.albumId);
  const aliases = [...new Set((source.alias ?? source.aliases ?? source.transNames ?? []).map(String).filter(Boolean))];
  const title = String(source.name ?? "").trim();
  return {
    internalId: `album:${albumId}`,
    id: `album:${albumId}`,
    neteaseAlbumId: albumId,
    slug: seed.slug ?? safeSlug(title, albumId),
    title,
    aliases,
    artists,
    releaseDate,
    releaseDatePrecision: releaseDate ? "day" : null,
    albumType,
    company: typeof source.company === "string" && source.company.trim() ? source.company.trim() : null,
    cover: coverAvailable
      ? { kind: "local", src: `/catalog/covers/${albumId}.jpg`, thumbnailSrc: null, alt: `《${title}》专辑封面`, reason: null }
      : { kind: "fallback", src: null, thumbnailSrc: null, alt: `《${title}》封面暂缺`, reason: "dry_run_cover_not_published" },
    tracks: songs.map((song, index) => ({
      id: `netease-track:${song.id ?? `${albumId}-${index + 1}`}`,
      neteaseTrackId: song.id == null ? null : String(song.id),
      title: String(song.name ?? `曲目 ${index + 1}`),
      trackNumber: Number.isInteger(Number(song.no)) ? Number(song.no) : index + 1,
      discNumber: Number(String(song.cd ?? "1").match(/\d+/)?.[0] ?? 1),
      artists: (song.ar ?? song.artists ?? []).map((artist) => String(artist?.name ?? "")).filter(Boolean),
      durationMs: Number.isFinite(Number(song.dt ?? song.duration)) ? Number(song.dt ?? song.duration) : null,
    })),
    trackCount: songs.length,
    externalUrl: `https://music.163.com/#/album?id=${albumId}`,
    discoveredAt: seed.discoveredAt ?? fetchedAt,
    updatedAt: fetchedAt,
    sourceMarketChannels: [],
    coreGenres: [...new Set(seed.coreGenres)],
    relatedGenres: [],
    descriptors: [],
    contexts: normalizeListeningScenes(seed.contexts),
    rymRating: null,
    rymRatingCount: null,
    rymReference: null,
    rymObservedAt: null,
    rymInputSourceId: null,
    rymMatchStatus: "UNVERIFIED_NO_DATA",
    editorial: null,
    searchText: [title, ...aliases, ...artists.map((artist) => artist.name)].join(" "),
    source: {
      catalog: "netease",
      fetchedAt,
      parserVersion: "netease-sync-v1",
      verificationMethod: "reviewed_local_seed",
      error: null,
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await Promise.all([mkdir(rawCache, { recursive: true }), mkdir(cacheRoot, { recursive: true })]);
  const [stableCatalog, identities, rymSnapshot, seedInput, checkpoint] = await Promise.all([
    readJson(catalogPath),
    readJson(identitiesPath, {}),
    readJson(rymSnapshotPath),
    loadSeeds(options.seed),
    readJson(checkpointPath, { processedAlbumIds: [] }),
  ]);
  const seeds = await expandArtistSeeds(seedInput);
  const result = await runCatalogSync({
    seeds,
    stableCatalog,
    resume: options.resume,
    dryRun: options.dryRun,
    limit: options.limit,
    checkpoint,
    fetchAlbum: async (seed) => {
      const file = path.join(rawCache, `album-${seed.albumId}.json`);
      let payload = await readJson(file);
      const cacheHit = Boolean(payload);
      if (!payload) {
        payload = await requestJson(seed.albumId);
        await writeFile(file, `${JSON.stringify(payload)}\n`, "utf8");
      }
      let coverAvailable = false;
      try {
        const cover = await stat(path.join(root, "public", "catalog", "covers", `${seed.albumId}.jpg`));
        coverAvailable = cover.size >= 1_000;
      } catch {
        coverAvailable = false;
      }
      if (!coverAvailable && !options.dryRun) {
        await ensureLocalCover(seed.albumId, payload?.album?.picUrl ?? payload?.album?.coverUrl);
        coverAvailable = true;
      }
      if (coverAvailable && !options.dryRun) await ensureOptimizedCovers(seed.albumId);
      const album = normalizePayload(seed, payload, new Date().toISOString(), coverAvailable);
      return { album, cacheHit };
    },
    validateCatalog: async (candidate) => validateCatalogData(candidate, identities, rymSnapshot),
    publishCatalog,
    onCheckpoint: async (value) => writeFile(checkpointPath, `${JSON.stringify(value, null, 2)}\n`, "utf8"),
    onFailure: async (failure) => appendFile(failureLogPath, `${JSON.stringify({ ...failure, at: new Date().toISOString() })}\n`, "utf8"),
  });
  await writeFile(summaryPath, `${JSON.stringify({ ...result.summary, completedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.failures.length) process.exitCode = 2;
}

await main();
