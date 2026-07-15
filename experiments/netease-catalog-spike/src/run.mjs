import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPERIMENT_DIR = path.resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = path.join(EXPERIMENT_DIR, "sample-manifest.json");
const OUTPUT_DIR = path.join(EXPERIMENT_DIR, "output");
const REQUEST_LOG_PATH = path.join(OUTPUT_DIR, "request-log.jsonl");
const NORMALIZED_PATH = path.join(OUTPUT_DIR, "normalized-samples.json");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "run-summary.json");

const BASE_URL = "https://music.163.com";
const ALLOWED_HOST = "music.163.com";
const MIN_REQUEST_GAP_MS = 2_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUESTS = 60;
const EXPECTED_REGION_COUNTS = {
  mainland_china: 5,
  hong_kong: 2,
  taiwan: 2,
  europe_us: 5,
  japan: 2,
  south_korea: 2,
};

let requestCount = 0;
let lastAttemptCompletedAt = 0;
const requestStats = {
  successful: 0,
  failed: 0,
  blocked: 0,
  retries: 0,
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDiscNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function validateManifest(samples) {
  if (!Array.isArray(samples) || samples.length < 18) {
    throw new Error("Manifest must contain at least 18 samples.");
  }

  const requiredFields = [
    "region_group",
    "artist_query",
    "album_query",
    "expected_release_year",
    "reason",
  ];
  const counts = {};

  for (const sample of samples) {
    for (const field of requiredFields) {
      if (sample[field] === null || sample[field] === undefined || sample[field] === "") {
        throw new Error(`Sample ${sample.sample_id ?? "unknown"} is missing ${field}.`);
      }
    }
    counts[sample.region_group] = (counts[sample.region_group] ?? 0) + 1;
  }

  for (const [region, expected] of Object.entries(EXPECTED_REGION_COUNTS)) {
    if (counts[region] !== expected) {
      throw new Error(`Region ${region} must contain ${expected} samples, found ${counts[region] ?? 0}.`);
    }
  }

  return counts;
}

async function waitForRateLimit() {
  const elapsed = Date.now() - lastAttemptCompletedAt;
  if (lastAttemptCompletedAt && elapsed < MIN_REQUEST_GAP_MS) {
    await sleep(MIN_REQUEST_GAP_MS - elapsed);
  }
}

function classifyRestriction(httpStatus, responseText, payload) {
  if ([401, 403, 429].includes(httpStatus)) return `http_${httpStatus}`;
  const businessCode = Number(payload?.code);
  if ([301, 302, 401, 403, 429, -460].includes(businessCode)) {
    return `upstream_${businessCode}`;
  }
  if (/captcha|验证码|风控|risk.?control|login required/iu.test(responseText)) {
    return "captcha_or_risk_control";
  }
  return null;
}

async function writeRequestLog(entry) {
  await appendFile(REQUEST_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

async function requestJson({ testType, target, endpoint, method = "GET", form = null }) {
  const url = new URL(endpoint, BASE_URL);
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST) {
    throw new Error(`Blocked non-allowlisted URL: ${url.href}`);
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (requestCount >= MAX_REQUESTS) {
      return { ok: false, blocked: true, errorCategory: "request_budget_exhausted" };
    }

    await waitForRateLimit();
    requestCount += 1;
    if (attempt > 0) requestStats.retries += 1;

    const requestNumber = requestCount;
    const requestedAt = new Date().toISOString();
    const startedAt = performance.now();
    let httpStatus = null;

    try {
      const options = {
        method,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      };
      if (form) options.body = new URLSearchParams(form);

      const response = await fetch(url, options);
      httpStatus = response.status;
      const responseText = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = null;
      }

      const restriction = classifyRestriction(httpStatus, responseText, payload);
      const businessCode = Number(payload?.code);
      const businessOk =
        !Number.isFinite(businessCode) || businessCode === 0 || businessCode === 200;
      const success = response.ok && payload !== null && !restriction && businessOk;
      const errorCategory = success
        ? null
        : restriction ??
          (payload === null
            ? "invalid_json"
            : response.ok
              ? `upstream_${payload.code ?? "unknown"}`
              : `http_${httpStatus}`);
      const durationMs = Math.round(performance.now() - startedAt);

      await writeRequestLog({
        request_number: requestNumber,
        test_type: testType,
        target,
        requested_at: requestedAt,
        http_status: httpStatus,
        duration_ms: durationMs,
        success,
        error_category: errorCategory,
      });
      lastAttemptCompletedAt = Date.now();

      if (success) {
        requestStats.successful += 1;
        return { ok: true, payload, httpStatus };
      }

      if (restriction) {
        requestStats.blocked += 1;
        return { ok: false, blocked: true, errorCategory, httpStatus };
      }

      requestStats.failed += 1;
      const retryable = httpStatus >= 500;
      if (!retryable || attempt === 1) {
        return { ok: false, blocked: false, errorCategory, httpStatus };
      }
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const errorCategory = error?.name === "TimeoutError" ? "timeout" : "network_error";
      await writeRequestLog({
        request_number: requestNumber,
        test_type: testType,
        target,
        requested_at: requestedAt,
        http_status: httpStatus,
        duration_ms: durationMs,
        success: false,
        error_category: errorCategory,
      });
      lastAttemptCompletedAt = Date.now();
      requestStats.failed += 1;
      if (attempt === 1) {
        return { ok: false, blocked: false, errorCategory, httpStatus };
      }
    }
  }

  return { ok: false, blocked: false, errorCategory: "unknown_failure" };
}

function albumArtists(album) {
  return toArray(album?.artists ?? album?.ar ?? album?.artist).filter(Boolean);
}

function selectAlbumCandidate(sample, albums) {
  const albumQuery = normalizeText(sample.album_query);
  const artistQuery = normalizeText(sample.artist_query);

  const ranked = toArray(albums)
    .map((album) => {
      const title = normalizeText(album?.name);
      const artists = normalizeText(albumArtists(album).map((artist) => artist?.name).join(" "));
      const year = toIsoDate(album?.publishTime)?.slice(0, 4);
      let score = 0;
      if (title === albumQuery) score += 10;
      else if (title.includes(albumQuery) || albumQuery.includes(title)) score += 4;
      if (artists === artistQuery) score += 8;
      else if (artists.includes(artistQuery) || artistQuery.includes(artists)) score += 4;
      if (year === String(sample.expected_release_year)) score += 3;
      return { album, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score >= 8 ? ranked[0] : null;
}

function explicitHints(album) {
  const regionFields = ["area", "region", "country", "countryCode", "locale"]
    .filter((field) => album?.[field] !== null && album?.[field] !== undefined && album?.[field] !== "")
    .map((field) => ({ field, value: album[field] }));
  const languageFields = ["language", "lang"]
    .filter((field) => album?.[field] !== null && album?.[field] !== undefined && album?.[field] !== "")
    .map((field) => ({ field, value: album[field] }));

  return {
    languageHint: languageFields.length ? languageFields : null,
    regionHint: regionFields.length
      ? { classification: "direct", evidence: regionFields }
      : { classification: "unavailable", evidence: [] },
  };
}

function normalizeAlbum(sample, detailPayload, matchScore) {
  const album = detailPayload?.album ?? {};
  const songs = toArray(detailPayload?.songs ?? album?.songs);
  const artists = albumArtists(album);
  const releaseDate = toIsoDate(album?.publishTime ?? album?.releaseDate);
  const hints = explicitHints(album);

  return {
    sample_id: sample.sample_id,
    sample_region_group: sample.region_group,
    match_score: matchScore,
    netease_album_id: album?.id === null || album?.id === undefined ? null : String(album.id),
    title: album?.name ?? null,
    aliases: toArray(album?.alias ?? album?.aliases ?? album?.transNames).filter(Boolean),
    artists: artists.map((artist) => artist?.name).filter(Boolean),
    artist_ids: artists
      .map((artist) => artist?.id)
      .filter((id) => id !== null && id !== undefined)
      .map(String),
    release_date: releaseDate,
    release_year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    album_type: album?.type ?? null,
    sub_type: album?.subType ?? album?.subtype ?? null,
    company: album?.company ?? album?.publishCompany ?? null,
    cover_url: album?.picUrl ?? album?.coverUrl ?? null,
    track_count: Number.isFinite(Number(album?.size ?? album?.trackCount))
      ? Number(album?.size ?? album?.trackCount)
      : songs.length || null,
    tracks: songs.map((song, index) => {
      const trackArtists = toArray(song?.ar ?? song?.artists).filter(Boolean);
      return {
        netease_track_id:
          song?.id === null || song?.id === undefined ? null : String(song.id),
        title: song?.name ?? null,
        track_number: Number.isFinite(Number(song?.no ?? song?.trackNumber))
          ? Number(song?.no ?? song?.trackNumber)
          : index + 1,
        disc_number: parseDiscNumber(song?.cd ?? song?.disc),
        artists: trackArtists.map((artist) => artist?.name).filter(Boolean),
        duration_ms: Number.isFinite(Number(song?.dt ?? song?.duration))
          ? Number(song?.dt ?? song?.duration)
          : null,
      };
    }),
    netease_url:
      album?.id === null || album?.id === undefined
        ? null
        : `https://music.163.com/#/album?id=${album.id}`,
    language_hint: hints.languageHint,
    region_hint: hints.regionHint,
    source_endpoint: "/api/v1/album/:id",
    fetched_at: new Date().toISOString(),
  };
}

function calculateCoverage(samples) {
  const fields = [
    "netease_album_id",
    "title",
    "aliases",
    "artists",
    "artist_ids",
    "release_date",
    "release_year",
    "album_type",
    "sub_type",
    "company",
    "cover_url",
    "track_count",
    "tracks",
    "netease_url",
    "language_hint",
    "region_hint",
  ];

  return Object.fromEntries(
    fields.map((field) => {
      const present = samples.filter((sample) => {
        const value = sample[field];
        if (field === "region_hint") return value?.classification !== "unavailable";
        if (Array.isArray(value)) return value.length > 0;
        return value !== null && value !== undefined && value !== "";
      }).length;
      return [
        field,
        {
          present,
          total: samples.length,
          percentage: samples.length ? Number(((present / samples.length) * 100).toFixed(1)) : 0,
        },
      ];
    }),
  );
}

async function main() {
  const samples = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const regionCounts = validateManifest(samples);

  if (process.argv.includes("--validate-only")) {
    console.log(JSON.stringify({ valid: true, sample_count: samples.length, region_counts: regionCounts }, null, 2));
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(REQUEST_LOG_PATH, "", "utf8");

  const startedAt = new Date().toISOString();
  const normalizedSamples = [];
  const sampleFailures = [];
  const artistProbeCandidates = new Map();
  const blockedCapabilities = new Set();

  for (const sample of samples) {
    if (blockedCapabilities.has("album_search")) {
      sampleFailures.push({ sample_id: sample.sample_id, stage: "search", error: "capability_blocked" });
      continue;
    }

    const searchResult = await requestJson({
      testType: "album_search",
      target: `${sample.artist_query} / ${sample.album_query}`,
      endpoint: "/api/search/get",
      method: "POST",
      form: {
        s: `${sample.artist_query} ${sample.album_query}`,
        type: "10",
        limit: "20",
        offset: "0",
      },
    });

    if (!searchResult.ok) {
      if (searchResult.blocked) blockedCapabilities.add("album_search");
      sampleFailures.push({
        sample_id: sample.sample_id,
        stage: "search",
        error: searchResult.errorCategory,
      });
      continue;
    }

    const albums = searchResult.payload?.result?.albums ?? searchResult.payload?.albums ?? [];
    const candidate = selectAlbumCandidate(sample, albums);
    if (!candidate) {
      sampleFailures.push({ sample_id: sample.sample_id, stage: "match", error: "no_confident_candidate" });
      continue;
    }

    if (blockedCapabilities.has("album_detail")) {
      sampleFailures.push({ sample_id: sample.sample_id, stage: "detail", error: "capability_blocked" });
      continue;
    }

    const albumId = candidate.album.id;
    const detailResult = await requestJson({
      testType: "album_detail",
      target: String(albumId),
      endpoint: `/api/v1/album/${encodeURIComponent(albumId)}`,
    });

    if (!detailResult.ok) {
      if (detailResult.blocked) blockedCapabilities.add("album_detail");
      sampleFailures.push({
        sample_id: sample.sample_id,
        stage: "detail",
        error: detailResult.errorCategory,
      });
      continue;
    }

    const normalized = normalizeAlbum(sample, detailResult.payload, candidate.score);
    normalizedSamples.push(normalized);
    const firstArtistId = normalized.artist_ids[0];
    if (firstArtistId && !artistProbeCandidates.has(sample.region_group)) {
      artistProbeCandidates.set(sample.region_group, {
        id: firstArtistId,
        name: normalized.artists[0] ?? null,
        region_group: sample.region_group,
      });
    }
  }

  const artistAlbumProbes = [];
  for (const candidate of artistProbeCandidates.values()) {
    if (blockedCapabilities.has("artist_albums")) break;
    const result = await requestJson({
      testType: "artist_albums",
      target: `${candidate.id} / ${candidate.name ?? "unknown"}`,
      endpoint: `/api/artist/albums/${encodeURIComponent(candidate.id)}`,
      method: "POST",
      form: { limit: "10", offset: "0", total: "true" },
    });
    if (result.blocked) blockedCapabilities.add("artist_albums");
    const albums = result.ok
      ? toArray(result.payload?.hotAlbums ?? result.payload?.albums)
      : [];
    artistAlbumProbes.push({
      ...candidate,
      success: result.ok,
      returned_album_count: albums.length,
      error_category: result.ok ? null : result.errorCategory,
    });
  }

  const newReleaseProbes = [];
  for (const area of ["ALL", "ZH", "EA", "JP", "KR"]) {
    if (blockedCapabilities.has("new_releases")) break;
    const result = await requestJson({
      testType: "new_releases",
      target: `area=${area}`,
      endpoint: "/api/album/new",
      method: "POST",
      form: { area, limit: "10", offset: "0", total: "true" },
    });
    if (result.blocked) blockedCapabilities.add("new_releases");
    const albums = result.ok
      ? toArray(result.payload?.albums ?? result.payload?.monthData ?? result.payload?.weekData)
      : [];
    const explicitRegionCount = albums.filter((album) =>
      ["area", "region", "country", "countryCode", "locale"].some(
        (field) => album?.[field] !== null && album?.[field] !== undefined && album?.[field] !== "",
      ),
    ).length;
    newReleaseProbes.push({
      area,
      success: result.ok,
      returned_album_count: albums.length,
      explicit_region_field_count: explicitRegionCount,
      region_evidence_classification: result.ok ? "inferred" : "unavailable",
      region_evidence_note: result.ok
        ? "The area code is a request channel, not a direct per-album nationality field."
        : null,
      error_category: result.ok ? null : result.errorCategory,
    });
  }

  const completedAt = new Date().toISOString();
  const summary = {
    stage: "0.15A",
    started_at: startedAt,
    completed_at: completedAt,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    access_method: "Direct anonymous Node.js fetch to public music.163.com metadata endpoints",
    domains_accessed: [ALLOWED_HOST],
    credentials: {
      login_used: false,
      cookie_used: false,
      token_used: false,
      custom_headers_used: false,
      proxy_used: false,
    },
    limits: {
      max_requests: MAX_REQUESTS,
      min_gap_ms: MIN_REQUEST_GAP_MS,
      max_retry_per_failure: 1,
      concurrency: 1,
    },
    requests: {
      total: requestCount,
      ...requestStats,
    },
    manifest: {
      sample_count: samples.length,
      region_counts: regionCounts,
      representative_of_full_catalog: false,
    },
    sample_results: {
      normalized_count: normalizedSamples.length,
      failed_count: sampleFailures.length,
      failures: sampleFailures,
    },
    blocked_capabilities: [...blockedCapabilities],
    artist_album_probes: artistAlbumProbes,
    new_release_probes: newReleaseProbes,
    field_coverage: calculateCoverage(normalizedSamples),
    region_assessment: {
      direct_sample_count: normalizedSamples.filter(
        (sample) => sample.region_hint?.classification === "direct",
      ).length,
      inferred_new_release_channels: newReleaseProbes.filter(
        (probe) => probe.region_evidence_classification === "inferred",
      ).map((probe) => probe.area),
      conclusion:
        "Sample region labels are test expectations only. They are never used as API-derived nationality evidence.",
    },
  };

  await writeFile(NORMALIZED_PATH, `${JSON.stringify(normalizedSamples, null, 2)}\n`, "utf8");
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        completed: true,
        request_count: requestCount,
        normalized_count: normalizedSamples.length,
        failed_sample_count: sampleFailures.length,
        blocked_capabilities: [...blockedCapabilities],
      },
      null,
      2,
    ),
  );
}

await main();
