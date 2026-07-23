import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CURATED_NETEASE_ARTISTS } from "./netease-curated-artists.mjs";
import identities from "./netease-identities.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "../..");
const cacheDir = path.join(root, ".cache", "catalog", "netease");
const outputPath = path.join(root, "scripts", "catalog", "netease-expanded-seeds.json");
const reportPath = path.join(root, "reports", "catalog", "artist-discovery-report.json");
const baseUrl = "https://music.163.com";
const minimumGapMs = 2_000;
const pageSize = 50;
const maximumPages = 3;
const minimumCatalogSize = 300;
const excludedAlbumIds = new Set(["132396968"]);
let lastRequestCompletedAt = 0;
let requestCount = 0;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\s]+/gu, "");

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function requestArtistAlbums(rule, offset) {
  const cachePath = path.join(cacheDir, `artist-albums-${rule.artistId}-${offset}.json`);
  const cached = await readJson(cachePath);
  if (cached) return { payload: cached, fromCache: true };
  const wait = minimumGapMs - (Date.now() - lastRequestCompletedAt);
  if (wait > 0) await sleep(wait);
  const requestedAt = new Date().toISOString();
  const response = await fetch(`${baseUrl}/api/artist/albums/${encodeURIComponent(rule.artistId)}?offset=${offset}&limit=${pageSize}`, {
    signal: AbortSignal.timeout(20_000),
  });
  requestCount += 1;
  lastRequestCompletedAt = Date.now();
  if ([401, 403, 429].includes(response.status)) throw new Error(`restricted_http_${response.status}`);
  if (!response.ok) throw new Error(`http_${response.status}`);
  const payload = await response.json();
  if (payload?.code !== 200 || !Array.isArray(payload?.hotAlbums)) throw new Error("invalid_artist_album_payload");
  await writeFile(cachePath, `${JSON.stringify({ ...payload, _catalogRequest: { requestedAt, status: response.status } })}\n`, "utf8");
  return { payload, fromCache: false };
}

function classifyAlbum(album, rule) {
  const type = normalize(album?.type);
  const subtype = normalize(album?.subType);
  const title = normalize(album?.name);
  const collectionPattern = /精选|极品|典藏|合集|全记录|纪念|周年|珍藏|真经典|十年经典|巨星|正传|回顾|自选|专场|全集|金曲篇|突破篇|国语篇|致敬篇|创作篇|电影篇|想像张国荣|唱与被唱|哥哥的歌|继续张国荣|无条件唱|大热untitled|情菲得意|传奇胡思乱想|你王菲所以我王菲|崔健19861996|第\d+期|collection|collections|greatest|best|anthology|anniversary|boxset|lpcd|k2hd|sacd|remaster|deluxe|expandededition|morefayewong|initialj|separateways|ultrasound乐之路|remembrance|revisit|missyoumuchleslie/;
  const soundtrackPattern = /原声|电影|电视剧|影视|剧集|网剧|音乐特别企划/;
  const soundtrackArtists = new Set(["94064", "3726", "15289"]);
  if (type === "single" || type.includes("单曲")) return { accepted: false, reason: "single" };
  if (type.includes("精选") || subtype.includes("精选") || collectionPattern.test(title)) return { accepted: false, reason: "compilation_or_reissue" };
  if (soundtrackPattern.test(title) && !soundtrackArtists.has(rule.artistId)) return { accepted: false, reason: "unreviewed_soundtrack" };
  if (type.includes("live") || subtype.includes("现场") || title.includes("演唱会") || title.includes("live")) return { accepted: false, reason: "live" };
  if (subtype.includes("remix") || title.includes("remix") || title.includes("伴奏")) return { accepted: false, reason: "remix_or_instrumental" };
  const acceptedType = type === "专辑" || type === "album" || type === "ep" ||
    type.includes("mixtape") || type.includes("soundtrack") || type.includes("原声") || subtype.includes("原声");
  if (!acceptedType) return { accepted: false, reason: "unsupported_type" };
  if (!Number.isInteger(Number(album?.size)) || Number(album.size) < 2) return { accepted: false, reason: "too_few_tracks" };
  return { accepted: true, reason: null };
}

async function main() {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  const existingIds = new Set(Object.values(identities).map((identity) => String(identity.albumId)));
  const selectedById = new Map();
  const selectedReleaseKeys = new Set();
  const rejectedCounts = {};
  const artists = [];
  const errors = [];

  for (const rule of CURATED_NETEASE_ARTISTS) {
    const acceptedForArtist = [];
    let pagesRead = 0;
    let offset = 0;
    try {
      while (pagesRead < maximumPages && acceptedForArtist.length < rule.maximumAlbums) {
        const { payload, fromCache } = await requestArtistAlbums(rule, offset);
        pagesRead += 1;
        const upstreamArtistName = payload?.artist?.name ?? rule.artistName;
        if (String(payload?.artist?.id ?? rule.artistId) !== rule.artistId) {
          throw new Error(`artist_identity_mismatch:${upstreamArtistName}`);
        }
        for (const album of payload.hotAlbums) {
          const albumId = String(album?.id ?? "");
          if (!/^\d+$/.test(albumId) || existingIds.has(albumId) || selectedById.has(albumId) || excludedAlbumIds.has(albumId)) continue;
          const classification = classifyAlbum(album, rule);
          if (!classification.accepted) {
            rejectedCounts[classification.reason] = (rejectedCounts[classification.reason] ?? 0) + 1;
            continue;
          }
          const releaseYear = new Date(Number(album.publishTime)).toISOString().slice(0, 4);
          const releaseKey = `${rule.artistId}:${normalize(album.name)}:${releaseYear}`;
          if (selectedReleaseKeys.has(releaseKey)) {
            rejectedCounts.duplicate_release_identity = (rejectedCounts.duplicate_release_identity ?? 0) + 1;
            continue;
          }
          const candidate = {
            albumId,
            slug: `netease-${albumId}`,
            artistId: rule.artistId,
            artistName: rule.artistName,
            albumTitle: String(album.name),
            expectedReleaseYear: releaseYear,
            expectedTrackCount: Number(album.size),
            expectedAlbumType: normalize(album.type) === "ep" ? "ep" :
              normalize(album.type).includes("mixtape") ? "mixtape" :
                normalize(album.type).includes("soundtrack") || normalize(album.type).includes("原声") || normalize(album.subType).includes("原声") ? "soundtrack" : "album",
            upstreamType: String(album.type ?? ""),
            upstreamSubType: String(album.subType ?? ""),
            coreGenres: rule.coreGenres,
            contexts: rule.contexts,
            discoveredAt: "2026-07-23T00:00:00.000Z",
            verificationMethod: "curated_artist_album_directory",
          };
          selectedById.set(albumId, candidate);
          selectedReleaseKeys.add(releaseKey);
          acceptedForArtist.push(albumId);
          if (acceptedForArtist.length >= rule.maximumAlbums) break;
        }
        if (!payload.more || payload.hotAlbums.length < pageSize) break;
        offset += pageSize;
        if (!fromCache) await sleep(minimumGapMs);
      }
      artists.push({ artistId: rule.artistId, artistName: rule.artistName, pagesRead, accepted: acceptedForArtist.length });
      console.log(`${rule.artistName}: ${acceptedForArtist.length} accepted from ${pagesRead} page(s)`);
    } catch (error) {
      errors.push({ artistId: rule.artistId, artistName: rule.artistName, errorCategory: String(error?.message ?? "unknown") });
      console.error(`${rule.artistName}: ${String(error?.message ?? "unknown")}`);
    }
  }

  const expandedSeeds = [...selectedById.values()];
  const projectedCatalogSize = existingIds.size + expandedSeeds.length;
  const report = {
    generatedAt: new Date().toISOString(),
    endpoint: "/api/artist/albums/:artistId",
    requestCount,
    artists,
    acceptedCandidates: expandedSeeds.length,
    existingCatalogSeeds: existingIds.size,
    projectedCatalogSize,
    rejectedCounts,
    errors,
  };
  await writeFile(outputPath, `${JSON.stringify({ version: 1, generatedAt: report.generatedAt, records: expandedSeeds }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Discovered ${expandedSeeds.length} fixed album candidates; projected catalog ${projectedCatalogSize}; ${requestCount} external requests.`);
  if (projectedCatalogSize < minimumCatalogSize) throw new Error(`Catalog floor not met: ${projectedCatalogSize} < ${minimumCatalogSize}.`);
}

await main();
