import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { inspectImage } from "./covers.mjs";
import { readBatchInput } from "./input.mjs";
import { sha256File, stableJson } from "./utils.mjs";

const METADATA_HOST = "music.163.com";
const COVER_HOST = /^p[1-4]\.music\.126\.net$/u;
const CODEC_EXTENSION = new Map([["mjpeg", ".jpg"], ["png", ".png"], ["webp", ".webp"]]);

export function sourceError(code, message, details = {}) { return Object.assign(new Error(`${code}: ${message}`), { code, ...details }); }

export async function requestSourceBytes(url, { fetchImpl, timeoutMs, retries, allowedHost }) {
  const requested = new URL(url);
  if (requested.protocol !== "https:" || !allowedHost(requested.hostname)) throw sourceError("ACQUISITION_HOST_FORBIDDEN", requested.hostname);
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let current = requested;
      let response;
      const hops = [];
      for (let redirects = 0; redirects <= 5; redirects += 1) {
        response = await fetchImpl(current, { method: "GET", redirect: "manual", signal: controller.signal, headers: { "user-agent": "AlbumDiscoveryContentPipeline/1" } });
        hops.push({ url: current.href, status: response.status });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        if (!location) throw sourceError("ACQUISITION_REDIRECT_MISSING_LOCATION", current.href);
        if (redirects === 5) throw sourceError("ACQUISITION_REDIRECT_LIMIT", current.href);
        current = new URL(location, current);
        if (current.protocol !== "https:" || !allowedHost(current.hostname)) throw sourceError("ACQUISITION_REDIRECT_FORBIDDEN", current.hostname);
      }
      const final = current;
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500 && response.status <= 599;
        if (retryable && attempt < retries) { last = sourceError("TRANSIENT_HTTP", String(response.status)); continue; }
        throw sourceError("ACQUISITION_HTTP_ERROR", String(response.status), { status: response.status });
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return { bytes, accounting: { requestUrl: requested.href, status: response.status, redirectCount: hops.length - 1, hops, finalHost: final.hostname, contentType: response.headers.get("content-type"), contentLength: response.headers.get("content-length"), attempts: attempt + 1 } };
    } catch (error) {
      if ((error?.name === "AbortError" || error?.code === "TRANSIENT_HTTP") && attempt < retries) { last = error; continue; }
      throw error?.name === "AbortError" ? sourceError("ACQUISITION_TIMEOUT", requested.href) : error;
    } finally { clearTimeout(timer); }
  }
  throw last;
}

function payloadDefects(payload) {
  const seen = new Set();
  const duplicates = [];
  for (const track of payload?.songs ?? []) {
    const key = `${track.cd ?? "1"}:${track.no}`;
    if (seen.has(key)) duplicates.push(key); else seen.add(key);
  }
  return duplicates.length ? [{ code: "SOURCE_PAYLOAD_DUPLICATE_POSITION", positions: [...new Set(duplicates)], disposition: "DO_NOT_IMPORT" }] : [];
}

export async function acquireBatch({ batchRoot, refresh = false, concurrency = 2, timeoutMs = 15_000, retries = 2, fetchImpl = globalThis.fetch }) {
  if (!fetchImpl) throw sourceError("FETCH_UNAVAILABLE", "Node fetch is unavailable.");
  const config = JSON.parse(await readFile(path.join(batchRoot, "batch.json"), "utf8"));
  const rows = await readBatchInput(path.join(batchRoot, config.input));
  const limit = Math.min(4, Math.max(1, Number(concurrency) || 2));
  const payloadRoot = path.join(batchRoot, "input", "payloads");
  const coverRoot = path.join(batchRoot, "incoming-covers");
  const reportRoot = path.join(batchRoot, "acquisition");
  const rawRoot = path.join(reportRoot, "raw");
  await Promise.all([payloadRoot, coverRoot, reportRoot, rawRoot].map((directory) => mkdir(directory, { recursive: true })));
  const results = new Array(rows.length);
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      const row = rows[index];
      const payloadFile = path.join(payloadRoot, `${row.albumId}.json`);
      try {
        let cached = false;
        try { await stat(payloadFile); cached = true; } catch (error) { if (error?.code !== "ENOENT") throw error; }
        const cachedCovers = [];
        for (const extension of CODEC_EXTENSION.values()) {
          const candidate = path.join(coverRoot, `${row.albumId}${extension}`);
          if (await stat(candidate).catch(() => null)) cachedCovers.push(candidate);
        }
        if (cachedCovers.length > 1) throw sourceError("COVER_SOURCE_COLLISION", row.albumId);
        if (cached && cachedCovers.length === 0) cached = false;
        if (cached && !refresh) {
          const stored = JSON.parse(await readFile(payloadFile, "utf8"));
          const payload = stored?.payload ?? stored;
          const rawFile = path.join(rawRoot, `album-${row.albumId}.response.json`);
          results[index] = { albumId: row.albumId, status: "CACHE_HIT", payloadSha256: await sha256File(payloadFile), rawResponse: await stat(rawFile).then(async (info) => ({ file: path.relative(batchRoot, rawFile).replaceAll("\\", "/"), sha256: await sha256File(rawFile), bytes: info.size })).catch(() => null), defects: payloadDefects(payload) };
          continue;
        }
        const metadata = await requestSourceBytes(`https://${METADATA_HOST}/api/v1/album/${row.albumId}`, { fetchImpl, timeoutMs, retries, allowedHost: (host) => host === METADATA_HOST });
        const payload = JSON.parse(metadata.bytes.toString("utf8"));
        if (String(payload?.album?.id ?? "") !== row.albumId) throw sourceError("SOURCE_IDENTITY_MISMATCH", row.albumId);
        const coverUrl = new URL(String(payload?.album?.picUrl ?? ""));
        if (!COVER_HOST.test(coverUrl.hostname)) throw sourceError("COVER_HOST_FORBIDDEN", coverUrl.hostname);
        const cover = await requestSourceBytes(coverUrl, { fetchImpl, timeoutMs, retries, allowedHost: (host) => COVER_HOST.test(host) });
        const probeFile = path.join(reportRoot, `.cover-${row.albumId}-${process.pid}.bin`);
        await writeFile(probeFile, cover.bytes);
        const decoded = await inspectImage(probeFile);
        const extension = CODEC_EXTENSION.get(decoded.codec);
        if (!extension || decoded.width > 20_000 || decoded.height > 20_000) throw sourceError("COVER_CODEC_OR_DIMENSIONS_INVALID", decoded.codec);
        const nextPayload = path.join(reportRoot, `.payload-${row.albumId}-${process.pid}.json`);
        const nextCover = path.join(reportRoot, `.source-${row.albumId}-${process.pid}${extension}`);
        const nextRaw = path.join(reportRoot, `.raw-${row.albumId}-${process.pid}.response.json`);
        await writeFile(nextPayload, stableJson(payload), "utf8");
        await writeFile(nextRaw, metadata.bytes);
        await rename(probeFile, nextCover);
        if (cached && refresh && (await sha256File(nextPayload) !== await sha256File(payloadFile) || await sha256File(nextCover) !== await sha256File(cachedCovers[0]))) {
          const driftRaw = path.join(reportRoot, `refresh-album-${row.albumId}.response.json`);
          await rm(driftRaw, { force: true });
          await rename(nextRaw, driftRaw);
          results[index] = { albumId: row.albumId, status: "SOURCE_REFRESH_DRIFT", payloadSha256: await sha256File(nextPayload), coverSha256: await sha256File(nextCover), rawResponse: { file: path.relative(batchRoot, driftRaw).replaceAll("\\", "/"), sha256: await sha256File(driftRaw), bytes: metadata.bytes.length }, accounting: { metadata: metadata.accounting, cover: cover.accounting }, defects: payloadDefects(payload) };
          continue;
        }
        if (await stat(payloadFile).catch(() => null)) await rm(payloadFile, { force: true });
        await rename(nextPayload, payloadFile);
        const destination = path.join(coverRoot, `${row.albumId}${extension}`);
        for (const old of cachedCovers) if (old !== destination) await rm(old, { force: true });
        await rm(destination, { force: true });
        await rename(nextCover, destination);
        const rawFile = path.join(rawRoot, `album-${row.albumId}.response.json`);
        await rm(rawFile, { force: true });
        await rename(nextRaw, rawFile);
        results[index] = { albumId: row.albumId, status: cached ? "REFRESHED" : "ACQUIRED", payloadSha256: await sha256File(payloadFile), rawResponse: { file: path.relative(batchRoot, rawFile).replaceAll("\\", "/"), sha256: await sha256File(rawFile), bytes: metadata.bytes.length }, cover: { file: path.basename(destination), sha256: await sha256File(destination), bytes: cover.bytes.length, ...decoded }, accounting: { metadata: metadata.accounting, cover: cover.accounting }, defects: payloadDefects(payload) };
      } catch (error) { results[index] = { albumId: row.albumId, status: "FAILED", code: error.code ?? "ACQUISITION_FAILED", message: String(error.message) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length || 1) }, worker));
  const report = { schema: "content-pipeline-v1/acquisition/v1", batchId: config.id, requested: rows.length, acquired: results.filter((item) => ["ACQUIRED", "REFRESHED"].includes(item.status)).length, cacheHits: results.filter((item) => item.status === "CACHE_HIT").length, refreshDrift: results.filter((item) => item.status === "SOURCE_REFRESH_DRIFT").length, failed: results.filter((item) => item.status === "FAILED").length, sourceDefects: results.reduce((sum, item) => sum + (item.defects?.length ?? 0), 0), results };
  await writeFile(path.join(reportRoot, "report.json"), stableJson(report), "utf8");
  return report;
}
