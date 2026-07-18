import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CANDIDATES, EDITORIAL, TAXONOMY, VERIFIED_LINKS } from "./curation-manifest.mjs";
import { COVER_DIR, OUTPUT_DIR, REPORT_DIR, fetchJsonCached, fetchWithPolicy, formatDuration, isSafeExternalUrl, normalizeIdentity, partialDate, readJson, stableStringify, writeJson } from "./lib/catalog-utils.mjs";

const REFRESH_DATE = process.env.CATALOG_REFRESH_DATE ?? new Date().toISOString().slice(0, 10);
const MB_BASE = "https://musicbrainz.org/ws/2";
const APPLE_BASE = "https://itunes.apple.com/search";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GENRE_DEFAULTS = {
  "art-pop": { secondary: ["experimental-pop"], descriptors: ["层次丰富", "作者性"], contexts: ["专注聆听", "夜晚"] },
  "indie-rock": { secondary: ["alternative-rock"], descriptors: ["乐队感", "旋律性"], contexts: ["通勤", "专注聆听"] },
  "dream-pop": { secondary: ["shoegaze"], descriptors: ["朦胧", "空间感"], contexts: ["夜晚", "放松"] },
  "post-rock": { secondary: ["instrumental-rock"], descriptors: ["渐进", "动态强"], contexts: ["专注聆听", "独处"] },
  electronic: { secondary: ["idm"], descriptors: ["电子质感", "节奏鲜明"], contexts: ["通勤", "工作"] },
  ambient: { secondary: ["ambient-electronic"], descriptors: ["沉浸", "缓慢"], contexts: ["工作", "放松"] },
  jazz: { secondary: ["modern-jazz"], descriptors: ["即兴", "合奏互动"], contexts: ["晚餐", "专注聆听"] },
  "soul-rnb": { secondary: ["neo-soul"], descriptors: ["律动", "人声丰富"], contexts: ["周末", "放松"] },
  "hip-hop": { secondary: ["alternative-hip-hop"], descriptors: ["采样", "叙事性"], contexts: ["通勤", "专注聆听"] },
  folk: { secondary: ["singer-songwriter"], descriptors: ["亲密", "叙事性"], contexts: ["独处", "清晨"] },
  metal: { secondary: ["heavy-music"], descriptors: ["强劲", "高密度"], contexts: ["运动", "专注聆听"] },
  sinophone: { secondary: ["sinophone-album"], descriptors: ["华语表达", "完整专辑"], contexts: ["通勤", "专注聆听"] },
};

function escapeLucene(value) {
  return String(value).replace(/([+\-!(){}\[\]^"~*?:\\/])/g, "\\$1");
}

function artistNames(credit = []) {
  return credit.map((item) => item.name || item.artist?.name).filter(Boolean);
}

function exactIdentity(candidate, result) {
  if (normalizeIdentity(candidate.title) !== normalizeIdentity(result.title)) return false;
  const wantedArtist = normalizeIdentity(candidate.artist);
  return artistNames(result["artist-credit"]).some((name) => {
    const actual = normalizeIdentity(name);
    return wantedArtist.includes(actual) || actual.includes(wantedArtist);
  });
}

async function resolveReleaseGroup(candidate) {
  const query = `releasegroup:\"${escapeLucene(candidate.title)}\" AND artist:\"${escapeLucene(candidate.artist)}\"`;
  const url = `${MB_BASE}/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=8`;
  const data = await fetchJsonCached("musicbrainz-search", candidate.key, url);
  const exact = (data["release-groups"] ?? []).filter((item) => exactIdentity(candidate, item));
  const selected = exact.find((item) => item.score === 100) ?? exact[0];
  if (!selected || !UUID.test(selected.id)) throw new Error(`Ambiguous or unresolved MusicBrainz identity: ${candidate.artist} — ${candidate.title}`);
  return selected;
}

async function lookupReleaseGroup(candidate, id) {
  const inc = encodeURIComponent("releases+url-rels+genres+tags");
  return fetchJsonCached("musicbrainz-release-group", candidate.key, `${MB_BASE}/release-group/${id}?inc=${inc}&fmt=json`);
}

function releaseRank(release, groupDate) {
  let score = release.status === "Official" ? 0 : 1000;
  if (!release.date) score += 500;
  if (release.date && groupDate && release.date.startsWith(groupDate.slice(0, 4))) score -= 100;
  if (release.country === "XW") score -= 20;
  if (/deluxe|expanded|remaster|anniversary|bonus/i.test(`${release.title} ${release.disambiguation}`)) score += 200;
  return score;
}

async function selectRepresentativeRelease(candidate, detail) {
  const releases = [...(detail.releases ?? [])]
    .filter((release) => UUID.test(release.id) && release.status === "Official")
    .sort((a, b) => releaseRank(a, detail["first-release-date"]) - releaseRank(b, detail["first-release-date"]) || String(a.date).localeCompare(String(b.date)));
  for (const release of releases.slice(0, 4)) {
    const inc = encodeURIComponent("recordings+artist-credits+labels+release-groups+url-rels");
    const data = await fetchJsonCached("musicbrainz-release", `${candidate.key}-${release.id}`, `${MB_BASE}/release/${release.id}?inc=${inc}&fmt=json`);
    if ((data.media ?? []).some((medium) => (medium.tracks?.length ?? 0) > 0)) return data;
  }
  return null;
}

function normalizeTracks(release, albumArtists) {
  if (!release) return [];
  return (release.media ?? []).flatMap((medium, mediumIndex) =>
    (medium.tracks ?? []).map((track, trackIndex) => {
      const names = artistNames(track["artist-credit"]?.length ? track["artist-credit"] : release["artist-credit"]);
      return {
        id: track.recording?.id ?? track.id,
        title: track.title || track.recording?.title || "曲名暂缺",
        trackNumber: Number.parseInt(track.number, 10) || track.position || trackIndex + 1,
        discNumber: medium.position || mediumIndex + 1,
        artists: names.length ? names : albumArtists.map((artist) => artist.name),
        durationMs: formatDuration(track.length ?? track.recording?.length),
      };
    }),
  );
}

function platformForUrl(value, relationType = "") {
  const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  if (host.endsWith("bandcamp.com")) return { platform: "Bandcamp", kind: relationType.includes("purchase") ? "purchase" : "listen" };
  if (host === "open.spotify.com") return { platform: "Spotify", kind: "listen" };
  if (host.endsWith("music.apple.com") || host.endsWith("itunes.apple.com")) return { platform: "Apple Music", kind: "listen" };
  if (["music.youtube.com", "youtube.com", "youtu.be"].includes(host)) return { platform: "YouTube Music", kind: "listen" };
  if (host.endsWith("music.163.com")) return { platform: "网易云音乐", kind: "listen" };
  if (/purchase|stream/i.test(relationType)) return { platform: host, kind: relationType.includes("purchase") ? "purchase" : "listen" };
  return null;
}

function relationLinks(...relations) {
  const seen = new Set();
  const links = [];
  for (const relation of relations.flat()) {
    const value = relation?.url?.resource;
    if (!value || !isSafeExternalUrl(value)) continue;
    const meta = platformForUrl(value, relation.type ?? "");
    if (!meta) continue;
    const normalized = value.replace(/^http:/, "https:");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push({ ...meta, url: normalized, verified: true, verifiedAt: REFRESH_DATE, source: "MusicBrainz URL relationship" });
  }
  return links;
}

async function appleAlbumLink(candidate) {
  const wantedArtist = normalizeIdentity(candidate.artist);
  const primaryArtist = wantedArtist.split(/\band\b|\bthe london\b/)[0].trim();
  for (const country of ["US", "CN", "HK", "TW", "JP"]) {
    const params = new URLSearchParams({ term: `${candidate.artist} ${candidate.title}`, country, media: "music", entity: "album", limit: "10", explicit: "Yes" });
    const cacheKey = country === "US" ? candidate.key : `${candidate.key}-${country}`;
    const data = await fetchJsonCached("apple-search", cacheKey, `${APPLE_BASE}?${params}`, { gapMs: 3100 });
    const match = (data.results ?? []).find((item) => {
      const actualArtist = normalizeIdentity(item.artistName);
      return normalizeIdentity(item.collectionName) === normalizeIdentity(candidate.title) &&
        (wantedArtist.includes(actualArtist) || actualArtist.includes(wantedArtist) || (primaryArtist.length > 3 && actualArtist.includes(primaryArtist)));
    });
    if (match?.collectionViewUrl && isSafeExternalUrl(match.collectionViewUrl)) {
      return { platform: "Apple Music", kind: "listen", url: match.collectionViewUrl.replace(/^http:/, "https:"), verified: true, verifiedAt: REFRESH_DATE, source: `Apple iTunes Search API exact artist/title match (${country})` };
    }
  }
  return null;
}

let coverArtArchiveAvailable = true;

async function downloadCover(candidate, releaseGroupId) {
  if (!coverArtArchiveAvailable) {
    return { kind: "fallback", src: null, width: 250, height: 250, alt: `${candidate.title} 的生成式占位封面`, sourceUrl: null, retrievedAt: null, reason: "source_unavailable" };
  }
  const finalPath = path.join(COVER_DIR, `${candidate.key}.jpg`);
  const temporaryPath = `${finalPath}.tmp`;
  try {
    const response = await fetchWithPolicy(`https://coverartarchive.org/release-group/${releaseGroupId}/front-250`, { accept: "image/*", timeoutMs: 6000, attempts: 1, gapMs: 200 });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error(`Unexpected cover content type: ${contentType}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 1000 || bytes.byteLength > 2_000_000) throw new Error(`Unexpected cover size: ${bytes.byteLength}`);
    await mkdir(COVER_DIR, { recursive: true });
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, finalPath);
    return { kind: "local", src: `/catalog/covers/${candidate.key}.jpg`, width: 250, height: 250, alt: `${candidate.title} 专辑封面`, sourceUrl: `https://coverartarchive.org/release-group/${releaseGroupId}`, retrievedAt: REFRESH_DATE };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (error?.status !== 404) coverArtArchiveAvailable = false;
    return { kind: "fallback", src: null, width: 250, height: 250, alt: `${candidate.title} 的生成式占位封面`, sourceUrl: null, retrievedAt: null, reason: error?.status === 404 ? "not_available" : "fetch_failed" };
  }
}

function releaseType(result) {
  const primary = String(result["primary-type"] ?? "").toLowerCase();
  const secondary = (result["secondary-types"] ?? []).map((value) => String(value).toLowerCase());
  if (secondary.includes("mixtape/street")) return "mixtape";
  if (secondary.includes("live")) return "live";
  if (secondary.includes("compilation")) return "compilation";
  if (primary === "ep") return "ep";
  return primary === "album" ? "album" : "other";
}

function editorialFor(candidate, tracks) {
  const source = EDITORIAL[candidate.key];
  if (!source) return null;
  const [summaryZh, whyListenZh, bestFor, descriptors] = source;
  return { summaryZh, whyListenZh, bestFor, startWithTrackId: tracks[0]?.id ?? null, listeningApproachZh: whyListenZh, confidence: "metadata_based", humanReviewed: false, factNotes: [], descriptors };
}

async function buildAlbum(candidate) {
  const resolved = await resolveReleaseGroup(candidate);
  const artists = (resolved["artist-credit"] ?? []).map((credit) => ({ id: credit.artist?.id ?? credit.name, name: credit.name || credit.artist?.name })).filter((artist) => artist.name);
  const enriched = Boolean(EDITORIAL[candidate.key]);
  const detail = enriched ? await lookupReleaseGroup(candidate, resolved.id) : null;
  const representative = enriched ? await selectRepresentativeRelease(candidate, detail) : null;
  const tracks = normalizeTracks(representative, artists);
  const defaults = GENRE_DEFAULTS[candidate.primaryGenre];
  const editorial = editorialFor(candidate, tracks);
  const cover = await downloadCover(candidate, resolved.id);
  const links = relationLinks(detail?.relations ?? [], representative?.relations ?? []);
  for (const link of VERIFIED_LINKS[candidate.key] ?? []) {
    if (!isSafeExternalUrl(link.url) || links.some((existing) => existing.platform === link.platform)) continue;
    links.unshift({ ...link, verified: true, verifiedAt: REFRESH_DATE, source: "Manually verified direct album URL" });
  }
  if (enriched && !links.length) {
    const apple = await appleAlbumLink(candidate);
    if (apple) links.unshift(apple);
  }
  const seenPlatforms = new Set();
  const externalLinks = links.filter((link) => {
    if (seenPlatforms.has(link.platform)) return false;
    seenPlatforms.add(link.platform);
    return true;
  }).slice(0, 4);
  const searchText = [resolved.title, candidate.title, ...artists.map((artist) => artist.name), candidate.primaryGenre, ...defaults.secondary, ...(editorial?.descriptors ?? defaults.descriptors), ...defaults.contexts, editorial?.summaryZh ?? ""].join(" ").normalize("NFKC").toLocaleLowerCase("zh-CN");
  return {
    id: `mb:${resolved.id}`, slug: candidate.key, title: resolved.title,
    alternateTitles: normalizeIdentity(resolved.title) === normalizeIdentity(candidate.title) ? [] : [candidate.title],
    artists, releaseDate: partialDate(resolved["first-release-date"]), releaseType: releaseType(resolved),
    primaryGenres: [candidate.primaryGenre], secondaryGenres: defaults.secondary,
    descriptors: editorial?.descriptors ?? defaults.descriptors,
    contexts: [...new Set([...(editorial?.bestFor ?? []), ...defaults.contexts])],
    languages: representative?.["text-representation"]?.language
      ? { status: "verified", values: [representative["text-representation"].language], source: "MusicBrainz representative release text representation" }
      : { status: "unavailable", values: [], source: null },
    cover, tracks, externalLinks, musicbrainzReleaseGroupId: resolved.id,
    representativeReleaseId: representative?.id ?? null, editorial, searchText, addedAt: REFRESH_DATE,
    sourceSummary: { identity: "MusicBrainz release group", metadataUrl: `https://musicbrainz.org/release-group/${resolved.id}`, refreshedAt: REFRESH_DATE, editorial: editorial ? "original local metadata-based guide; not yet human-reviewed" : null },
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(COVER_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });
  const previousCatalog = await readJson(path.join(OUTPUT_DIR, "catalog.json"));
  const albums = [];
  const rejected = [];
  for (const [index, candidate] of CANDIDATES.entries()) {
    process.stdout.write(`[${index + 1}/${CANDIDATES.length}] ${candidate.artist} — ${candidate.title} ... `);
    try { albums.push(await buildAlbum(candidate)); console.log("ok"); }
    catch (error) { rejected.push({ key: candidate.key, artist: candidate.artist, title: candidate.title, reason: error.message }); console.log(`rejected: ${error.message}`); }
  }
  albums.sort((a, b) => a.slug.localeCompare(b.slug, "en"));
  const catalog = {
    version: 1, refreshDate: REFRESH_DATE,
    attribution: {
      musicbrainz: "Metadata from MusicBrainz, used under CC0; user-contributed data may also be under CC BY-SA.",
      coverArtArchive: "Cover art served by the Cover Art Archive and stored locally for this catalog snapshot; rights remain with their respective owners.",
      editorial: "Original metadata-based Chinese listening guides; not copied reviews and not expert ratings.",
    },
    taxonomy: TAXONOMY, albums,
  };
  const flagshipCount = albums.filter((album) => album.editorial).length;
  const linkedFlagshipCount = albums.filter((album) => album.editorial && album.externalLinks.length > 0).length;
  const report = { refreshDate: REFRESH_DATE, requested: CANDIDATES.length, published: albums.length, rejected, flagshipCount, linkedFlagshipCount, unlinkedFlagships: albums.filter((album) => album.editorial && album.externalLinks.length === 0).map((album) => album.slug), localCoverCount: albums.filter((album) => album.cover.kind === "local").length, fallbackCoverCount: albums.filter((album) => album.cover.kind === "fallback").length, taxonomyCount: TAXONOMY.length };
  if (albums.length < 120 || flagshipCount < 24 || linkedFlagshipCount < 24) {
    await writeJson(path.join(REPORT_DIR, "refresh-report.json"), report);
    if (previousCatalog) console.error("Refresh failed validation; previous good snapshot was preserved.");
    throw new Error(`Catalog minimum not met: ${albums.length} albums, ${flagshipCount} flagships, ${linkedFlagshipCount} linked flagships`);
  }
  await writeJson(path.join(OUTPUT_DIR, "catalog.json"), catalog);
  await writeJson(path.join(OUTPUT_DIR, "catalog.manifest.json"), report);
  await writeJson(path.join(REPORT_DIR, "refresh-report.json"), report);
  console.log(stableStringify(report));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
