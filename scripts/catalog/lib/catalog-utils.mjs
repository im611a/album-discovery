import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
export const CACHE_DIR = path.join(ROOT, ".cache", "catalog");
export const OUTPUT_DIR = path.join(ROOT, "src", "data", "generated");
export const COVER_DIR = path.join(ROOT, "public", "catalog", "covers");
export const REPORT_DIR = path.join(ROOT, "reports", "catalog");
export const USER_AGENT = "AlbumDiscovery/1.0 (contact: 3243113697@qq.com)";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const normalizeIdentity = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

export const stableStringify = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stableStringify(value), "utf8");
}

const schedulers = new Map();

async function waitForHost(host, gapMs) {
  const previous = schedulers.get(host) ?? 0;
  const wait = Math.max(0, previous + gapMs - Date.now());
  if (wait) await sleep(wait);
  schedulers.set(host, Date.now());
}

export async function fetchWithPolicy(url, options = {}) {
  const parsed = new URL(url);
  const gapMs = options.gapMs ?? (parsed.hostname === "musicbrainz.org" ? 1100 : 250);
  const attempts = options.attempts ?? 3;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await waitForHost(parsed.hostname, gapMs);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
    try {
      const response = await fetch(url, {
        ...options.fetchOptions,
        headers: { Accept: options.accept ?? "application/json", "User-Agent": USER_AGENT, ...options.fetchOptions?.headers },
        signal: controller.signal,
      });
      if (response.ok) return response;
      const error = new Error(`HTTP ${response.status} for ${url}`);
      error.status = response.status;
      if ([400, 401, 403, 404, 429].includes(response.status)) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if ([400, 401, 403, 404, 429].includes(error?.status)) throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt + 1 < attempts) await sleep(1500 * 2 ** attempt);
  }
  throw lastError;
}

export async function fetchJsonCached(namespace, key, url, options = {}) {
  const digest = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const cachePath = path.join(CACHE_DIR, namespace, `${key}-${digest}.json`);
  const cached = await readJson(cachePath);
  if (cached) return cached;
  const response = await fetchWithPolicy(url, options);
  const json = await response.json();
  await writeJson(cachePath, json);
  return json;
}

export function partialDate(value) {
  if (!value || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return null;
  return { value, precision: value.length === 4 ? "year" : value.length === 7 ? "month" : "day" };
}

export function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function formatDuration(milliseconds) {
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.round(milliseconds) : null;
}
