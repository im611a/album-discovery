import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPERIMENT_ROOT = path.resolve(SCRIPT_DIR, "..");
const NORMALIZED_015A_PATH = path.join(EXPERIMENT_ROOT, "output", "normalized-samples.json");
const MANIFEST_PATH = path.join(SCRIPT_DIR, "probe-manifest.json");
const CHANNEL_SAMPLES_PATH = path.join(SCRIPT_DIR, "channel-samples.json");
const ARTIST_RESULTS_PATH = path.join(SCRIPT_DIR, "artist-area-results.json");
const ALBUM_SEARCH_RESULTS_PATH = path.join(SCRIPT_DIR, "album-search-results.json");
const DUPLICATE_ANALYSIS_PATH = path.join(SCRIPT_DIR, "duplicate-analysis.json");
const REQUEST_LOG_PATH = path.join(SCRIPT_DIR, "request-log.jsonl");
const SUMMARY_PATH = path.join(SCRIPT_DIR, "run-summary.json");

const BASE_URL = "https://music.163.com";
const ALLOWED_HOST = "music.163.com";
const CHANNEL_AREAS = ["ALL", "ZH", "EA", "JP", "KR"];
const PRIMARY_CHANNEL_AREAS = ["ZH", "EA", "JP", "KR"];
const MAX_REQUESTS = 40;
const MAX_ARTIST_PROBES = 16;
const CHANNEL_LIMIT = 10;
const MIN_REQUEST_GAP_MS = 2_000;
const REQUEST_TIMEOUT_MS = 15_000;
const REGION_FIELD_PATTERN = /(area|region|country|locale|language|lang)/iu;

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

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function safeObservedValue(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return value;
  }
  if (Array.isArray(value) && value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
    return value.slice(0, 20);
  }
  return null;
}

function observeRegionFields(value, basePath = "") {
  const observations = [];

  function visit(current, currentPath, depth) {
    if (current === null || current === undefined || depth > 4) return;
    if (Array.isArray(current)) {
      current.slice(0, 20).forEach((item, index) => visit(item, `${currentPath}[${index}]`, depth + 1));
      return;
    }
    if (typeof current !== "object") return;

    for (const [key, child] of Object.entries(current)) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;
      if (REGION_FIELD_PATTERN.test(key)) {
        observations.push({
          field_path: fieldPath,
          field_name: key,
          data_type: valueType(child),
          value: safeObservedValue(child),
        });
      }
      if (child && typeof child === "object") visit(child, fieldPath, depth + 1);
    }
  }

  visit(value, basePath, 0);
  return observations;
}

function toIsoDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function validateInputs(manifest, normalizedSamples) {
  if (!Array.isArray(normalizedSamples) || normalizedSamples.length !== 17) {
    throw new Error(`Expected 17 normalized 0.15A samples, found ${normalizedSamples.length}.`);
  }
  if (!Array.isArray(manifest.artist_probes) || manifest.artist_probes.length > MAX_ARTIST_PROBES) {
    throw new Error(`Artist probes must contain at most ${MAX_ARTIST_PROBES} entries.`);
  }
  if (!Array.isArray(manifest.album_search_probes)) {
    throw new Error("album_search_probes must be an array.");
  }

  const knownArtists = new Map(
    normalizedSamples.flatMap((sample) =>
      toArray(sample.artist_ids).map((artistId, index) => [
        String(artistId),
        {
          sample_id: sample.sample_id,
          name: sample.artists?.[index] ?? sample.artists?.[0] ?? null,
        },
      ]),
    ),
  );
  const seenProbeKeys = new Set();
  for (const probe of manifest.artist_probes) {
    if (!probe.probe_id || !probe.query || !probe.manual_control_note) {
      throw new Error("Every artist probe requires probe_id, query, and manual_control_note.");
    }
    const key = probe.known_artist_id ? `id:${probe.known_artist_id}` : `query:${normalizeText(probe.query)}`;
    if (seenProbeKeys.has(key)) throw new Error(`Duplicate artist probe: ${key}`);
    seenProbeKeys.add(key);

    if (probe.source_sample_id) {
      const known = knownArtists.get(String(probe.known_artist_id));
      if (!known || known.sample_id !== probe.source_sample_id) {
        throw new Error(`Probe ${probe.probe_id} does not match the 0.15A normalized source.`);
      }
    }
  }

  const expectedBaseRequests =
    CHANNEL_AREAS.length + manifest.artist_probes.length * 2 + manifest.album_search_probes.length;
  if (expectedBaseRequests > MAX_REQUESTS) {
    throw new Error(`Base request plan ${expectedBaseRequests} exceeds budget ${MAX_REQUESTS}.`);
  }

  return {
    normalized_015a_count: normalizedSamples.length,
    artist_probe_count: manifest.artist_probes.length,
    album_search_probe_count: manifest.album_search_probes.length,
    channel_probe_count: CHANNEL_AREAS.length,
    expected_base_requests: expectedBaseRequests,
    retry_reserve: MAX_REQUESTS - expectedBaseRequests,
  };
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

async function requestJson({ testType, publicQueryParameter, endpoint, method = "GET", form = null }) {
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
      const businessOk = !Number.isFinite(businessCode) || businessCode === 0 || businessCode === 200;
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
        test_type: testType,
        public_query_parameter: publicQueryParameter,
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
        test_type: testType,
        public_query_parameter: publicQueryParameter,
        requested_at: requestedAt,
        http_status: httpStatus,
        duration_ms: durationMs,
        success: false,
        error_category: errorCategory,
      });
      lastAttemptCompletedAt = Date.now();
      requestStats.failed += 1;
      if (attempt === 1) return { ok: false, blocked: false, errorCategory, httpStatus };
    }
  }

  return { ok: false, blocked: false, errorCategory: "unknown_failure" };
}

function normalizeArtists(value) {
  return toArray(value).map((artist) => ({
    artist_id: artist?.id === null || artist?.id === undefined ? null : String(artist.id),
    name: artist?.name ?? null,
  }));
}

function normalizeChannelAlbum(album) {
  return {
    netease_album_id: album?.id === null || album?.id === undefined ? null : String(album.id),
    title: album?.name ?? null,
    artists: normalizeArtists(album?.artists ?? album?.ar),
    release_date: toIsoDate(album?.publishTime ?? album?.releaseDate),
    region_field_observations: observeRegionFields(album, "album"),
  };
}

function selectArtistCandidate(probe, artists) {
  if (probe.known_artist_id) {
    const byId = artists.find((artist) => String(artist?.id) === String(probe.known_artist_id));
    return byId ? { artist: byId, selection: "known_015a_artist_id" } : null;
  }
  const normalizedQuery = normalizeText(probe.query);
  const exact = artists.find((artist) => normalizeText(artist?.name) === normalizedQuery);
  return exact ? { artist: exact, selection: "exact_normalized_name" } : null;
}

function aggregateAreaValues(artistResults) {
  const counts = new Map();
  for (const result of artistResults) {
    for (const [source, observations] of [
      ["artist_search", result.search?.region_field_observations ?? []],
      ["artist_detail", result.detail?.region_field_observations ?? []],
    ]) {
      for (const observation of observations) {
        if (observation.field_name.toLocaleLowerCase("en-US") !== "area") continue;
        const key = JSON.stringify([source, observation.field_path, observation.data_type, observation.value]);
        const current = counts.get(key) ?? {
          source,
          field_path: observation.field_path,
          data_type: observation.data_type,
          value: observation.value,
          count: 0,
        };
        current.count += 1;
        counts.set(key, current);
      }
    }
  }
  return [...counts.values()];
}

function buildMembershipIndex(channelSamples, itemSelector) {
  const index = new Map();
  for (const channel of channelSamples.filter((entry) => PRIMARY_CHANNEL_AREAS.includes(entry.area_requested))) {
    for (const item of itemSelector(channel)) {
      if (!item.id) continue;
      const current = index.get(item.id) ?? { id: item.id, name: item.name, channels: new Set() };
      current.channels.add(channel.area_requested);
      index.set(item.id, current);
    }
  }
  return index;
}

function summarizeMembership(index, totalMemberships) {
  const items = [...index.values()];
  const duplicates = items
    .filter((item) => item.channels.size > 1)
    .map((item) => ({ ...item, channels: [...item.channels].sort() }));
  const uniqueCount = items.length;
  const excessMemberships = totalMemberships - uniqueCount;
  return {
    total_memberships: totalMemberships,
    unique_items: uniqueCount,
    items_in_multiple_channels: duplicates.length,
    excess_memberships: excessMemberships,
    duplicate_membership_rate_percentage:
      totalMemberships ? Number(((excessMemberships / totalMemberships) * 100).toFixed(1)) : 0,
    multi_channel_item_rate_percentage:
      uniqueCount ? Number(((duplicates.length / uniqueCount) * 100).toFixed(1)) : 0,
    duplicated_items: duplicates,
  };
}

function pairwiseChannelOverlap(channelSamples) {
  const sets = new Map(
    channelSamples
      .filter((entry) => PRIMARY_CHANNEL_AREAS.includes(entry.area_requested))
      .map((entry) => [entry.area_requested, new Set(entry.albums.map((album) => album.netease_album_id).filter(Boolean))]),
  );
  const results = [];
  for (let leftIndex = 0; leftIndex < PRIMARY_CHANNEL_AREAS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < PRIMARY_CHANNEL_AREAS.length; rightIndex += 1) {
      const leftArea = PRIMARY_CHANNEL_AREAS[leftIndex];
      const rightArea = PRIMARY_CHANNEL_AREAS[rightIndex];
      const left = sets.get(leftArea) ?? new Set();
      const right = sets.get(rightArea) ?? new Set();
      const common = [...left].filter((id) => right.has(id));
      const unionSize = new Set([...left, ...right]).size;
      results.push({
        left_area: leftArea,
        right_area: rightArea,
        common_album_count: common.length,
        common_album_ids: common,
        jaccard_percentage: unionSize ? Number(((common.length / unionSize) * 100).toFixed(1)) : 0,
      });
    }
  }
  return results;
}

function analyzeDuplicates(channelSamples) {
  const primaryChannels = channelSamples.filter((entry) => PRIMARY_CHANNEL_AREAS.includes(entry.area_requested));
  const albumMemberships = primaryChannels.reduce((total, entry) => total + entry.albums.length, 0);
  const artistMemberships = primaryChannels.reduce(
    (total, entry) =>
      total +
      new Set(
        entry.albums.flatMap((album) =>
          album.artists.map((artist) => artist.artist_id).filter(Boolean),
        ),
      ).size,
    0,
  );
  const albumIndex = buildMembershipIndex(channelSamples, (channel) =>
    channel.albums.map((album) => ({ id: album.netease_album_id, name: album.title })),
  );
  const artistIndex = buildMembershipIndex(channelSamples, (channel) =>
    channel.albums.flatMap((album) => album.artists.map((artist) => ({ id: artist.artist_id, name: artist.name }))),
  );

  const allControl = channelSamples.find((entry) => entry.area_requested === "ALL");
  const allIds = new Set(allControl?.albums.map((album) => album.netease_album_id).filter(Boolean) ?? []);
  return {
    definition:
      "Primary overlap uses ZH, EA, JP, and KR only. Duplicate membership rate is (memberships - unique IDs) / memberships.",
    album_overlap: summarizeMembership(albumIndex, albumMemberships),
    artist_overlap: summarizeMembership(artistIndex, artistMemberships),
    pairwise_album_overlap: pairwiseChannelOverlap(channelSamples),
    all_control_overlap: primaryChannels.map((channel) => {
      const ids = new Set(channel.albums.map((album) => album.netease_album_id).filter(Boolean));
      const common = [...ids].filter((id) => allIds.has(id));
      return {
        area: channel.area_requested,
        common_with_all_count: common.length,
        common_with_all_ids: common,
      };
    }),
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const normalizedSamples = JSON.parse(await readFile(NORMALIZED_015A_PATH, "utf8"));
  const validation = validateInputs(manifest, normalizedSamples);

  if (process.argv.includes("--validate-only")) {
    console.log(JSON.stringify({ valid: true, ...validation }, null, 2));
    return;
  }

  await writeFile(REQUEST_LOG_PATH, "", "utf8");
  const startedAt = new Date().toISOString();
  const blockedTests = new Set();
  const channelSamples = [];

  for (const area of CHANNEL_AREAS) {
    if (blockedTests.has("new_release_channel")) break;
    const result = await requestJson({
      testType: "new_release_channel",
      publicQueryParameter: `area=${area}&limit=${CHANNEL_LIMIT}&offset=0`,
      endpoint: "/api/album/new",
      method: "POST",
      form: { area, limit: String(CHANNEL_LIMIT), offset: "0", total: "true" },
    });
    if (result.blocked) blockedTests.add("new_release_channel");
    const rawAlbums = result.ok
      ? toArray(result.payload?.albums ?? result.payload?.monthData ?? result.payload?.weekData).slice(0, CHANNEL_LIMIT)
      : [];
    const albums = rawAlbums.map(normalizeChannelAlbum);
    channelSamples.push({
      area_requested: area,
      success: result.ok,
      returned_album_count: albums.length,
      albums,
      album_area_field_count: albums.filter((album) =>
        album.region_field_observations.some((field) => field.field_name.toLocaleLowerCase("en-US") === "area"),
      ).length,
      error_category: result.ok ? null : result.errorCategory,
    });
  }

  const artistResults = [];
  for (const probe of manifest.artist_probes) {
    let searchResult = { ok: false, errorCategory: "test_category_blocked" };
    if (!blockedTests.has("artist_search")) {
      searchResult = await requestJson({
        testType: "artist_search",
        publicQueryParameter: `query=${probe.query}&type=100&limit=10&offset=0`,
        endpoint: "/api/search/get",
        method: "POST",
        form: { s: probe.query, type: "100", limit: "10", offset: "0" },
      });
      if (searchResult.blocked) blockedTests.add("artist_search");
    }

    const artists = searchResult.ok
      ? toArray(searchResult.payload?.result?.artists ?? searchResult.payload?.artists)
      : [];
    const selected = selectArtistCandidate(probe, artists);
    const selectedArtist = selected?.artist ?? null;
    const selectedArtistId = selectedArtist?.id === null || selectedArtist?.id === undefined
      ? null
      : String(selectedArtist.id);

    let detailResult = { ok: false, errorCategory: selectedArtistId ? "test_category_blocked" : "no_confident_artist_match" };
    if (selectedArtistId && !blockedTests.has("artist_detail")) {
      detailResult = await requestJson({
        testType: "artist_detail",
        publicQueryParameter: `artist_id=${selectedArtistId}`,
        endpoint: `/api/v1/artist/${encodeURIComponent(selectedArtistId)}`,
      });
      if (detailResult.blocked) blockedTests.add("artist_detail");
    }
    const detailArtist = detailResult.ok ? detailResult.payload?.artist ?? null : null;

    artistResults.push({
      probe_id: probe.probe_id,
      query: probe.query,
      source_sample_id: probe.source_sample_id,
      manual_control_note: probe.manual_control_note,
      manual_control_is_api_evidence: false,
      search: {
        success: searchResult.ok,
        candidate_count: artists.length,
        selected_artist_id: selectedArtistId,
        selected_artist_name: selectedArtist?.name ?? null,
        selection_method: selected?.selection ?? null,
        region_field_observations: selectedArtist ? observeRegionFields(selectedArtist, "artist_search_result") : [],
        error_category: searchResult.ok && selected ? null : searchResult.errorCategory ?? "no_confident_artist_match",
      },
      detail: {
        success: detailResult.ok,
        endpoint: "/api/v1/artist/:id",
        artist_id: detailArtist?.id === null || detailArtist?.id === undefined ? selectedArtistId : String(detailArtist.id),
        artist_name: detailArtist?.name ?? selectedArtist?.name ?? null,
        region_field_observations: detailArtist ? observeRegionFields(detailArtist, "artist_detail") : [],
        error_category: detailResult.ok ? null : detailResult.errorCategory,
      },
    });
  }

  const albumSearchResults = [];
  for (const probe of manifest.album_search_probes) {
    if (blockedTests.has("album_search")) break;
    const result = await requestJson({
      testType: "album_search",
      publicQueryParameter: `query=${probe.query}&type=10&limit=10&offset=0`,
      endpoint: "/api/search/get",
      method: "POST",
      form: { s: probe.query, type: "10", limit: "10", offset: "0" },
    });
    if (result.blocked) blockedTests.add("album_search");
    const albums = result.ok
      ? toArray(result.payload?.result?.albums ?? result.payload?.albums).slice(0, 10)
      : [];
    albumSearchResults.push({
      probe_id: probe.probe_id,
      query: probe.query,
      reason: probe.reason,
      success: result.ok,
      returned_album_count: albums.length,
      albums: albums.map(normalizeChannelAlbum),
      error_category: result.ok ? null : result.errorCategory,
    });
  }

  const duplicateAnalysis = analyzeDuplicates(channelSamples);
  const areaValues = aggregateAreaValues(artistResults);
  const completedAt = new Date().toISOString();
  const summary = {
    stage: "0.15B",
    started_at: startedAt,
    completed_at: completedAt,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    domains_accessed: [ALLOWED_HOST],
    access_method: "Direct anonymous Node.js fetch to public music.163.com metadata endpoints",
    credentials: {
      login_used: false,
      cookie_used: false,
      token_used: false,
      authorization_used: false,
      custom_headers_used: false,
      browser_data_used: false,
      proxy_used: false,
    },
    limits: {
      max_requests: MAX_REQUESTS,
      min_gap_ms: MIN_REQUEST_GAP_MS,
      max_retry_per_failure: 1,
      concurrency: 1,
      channel_item_limit: CHANNEL_LIMIT,
      max_artist_probes: MAX_ARTIST_PROBES,
    },
    input_reuse: {
      normalized_015a_samples_read_locally: normalizedSamples.length,
      album_details_re_requested: 0,
    },
    validation,
    requests: {
      total: requestCount,
      ...requestStats,
    },
    blocked_tests: [...blockedTests],
    channel_results: channelSamples.map((channel) => ({
      area_requested: channel.area_requested,
      success: channel.success,
      returned_album_count: channel.returned_album_count,
      album_area_field_count: channel.album_area_field_count,
      error_category: channel.error_category,
    })),
    artist_results: {
      probes: artistResults.length,
      search_successes: artistResults.filter((result) => result.search.success).length,
      confident_search_matches: artistResults.filter((result) => result.search.selected_artist_id).length,
      detail_successes: artistResults.filter((result) => result.detail.success).length,
      search_area_field_count: artistResults.filter((result) =>
        result.search.region_field_observations.some((field) => field.field_name.toLocaleLowerCase("en-US") === "area"),
      ).length,
      detail_area_field_count: artistResults.filter((result) =>
        result.detail.region_field_observations.some((field) => field.field_name.toLocaleLowerCase("en-US") === "area"),
      ).length,
      observed_area_values: areaValues,
      area_semantics_confirmed: false,
    },
    album_search_results: {
      probes: albumSearchResults.length,
      successes: albumSearchResults.filter((result) => result.success).length,
      albums_with_region_like_fields: albumSearchResults.reduce(
        (count, result) => count + result.albums.filter((album) => album.region_field_observations.length > 0).length,
        0,
      ),
    },
    overlap_summary: {
      album_duplicate_membership_rate_percentage:
        duplicateAnalysis.album_overlap.duplicate_membership_rate_percentage,
      album_multi_channel_item_rate_percentage:
        duplicateAnalysis.album_overlap.multi_channel_item_rate_percentage,
      artist_duplicate_membership_rate_percentage:
        duplicateAnalysis.artist_overlap.duplicate_membership_rate_percentage,
    },
    evidence_boundary:
      "Channel parameters are request-side market labels. Manual controls and channel membership are not artist nationality or album origin fields.",
  };

  await writeFile(CHANNEL_SAMPLES_PATH, `${JSON.stringify(channelSamples, null, 2)}\n`, "utf8");
  await writeFile(ARTIST_RESULTS_PATH, `${JSON.stringify(artistResults, null, 2)}\n`, "utf8");
  await writeFile(ALBUM_SEARCH_RESULTS_PATH, `${JSON.stringify(albumSearchResults, null, 2)}\n`, "utf8");
  await writeFile(DUPLICATE_ANALYSIS_PATH, `${JSON.stringify(duplicateAnalysis, null, 2)}\n`, "utf8");
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        completed: true,
        request_count: requestCount,
        channel_count: channelSamples.length,
        artist_probe_count: artistResults.length,
        album_search_probe_count: albumSearchResults.length,
        blocked_tests: [...blockedTests],
      },
      null,
      2,
    ),
  );
}

await main();
