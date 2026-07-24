import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const cacheRoot = path.join(root, ".cache/catalog/online-smoke");
const reportPath = path.join(root, "reports/catalog/netease-online-smoke.json");
const catalogPath = path.join(root, "src/data/generated/catalog.json");
const catalogText = await readFile(catalogPath, "utf8");
const catalog = JSON.parse(catalogText);
const catalogSha256 = createHash("sha256").update(catalogText).digest("hex");
const albums = catalog.albums.slice(0, 10);
const artists = [...new Map(catalog.albums.flatMap((album) => album.artists).map((artist) => [artist.neteaseArtistId, artist])).values()].slice(0, 3);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
await mkdir(cacheRoot, { recursive: true });

async function request(kind, id, url, validate) {
  const cacheFile = path.join(cacheRoot, `${kind}-${id}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8"));
    return { kind, id, cacheHit: true, status: 200, ok: validate(cached), error: null };
  } catch {
    // Continue to the anonymous public request.
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "follow" });
      const result = { kind, id, cacheHit: false, status: response.status, ok: false, durationMs: Date.now() - started, error: null };
      if ([401, 403, 429].includes(response.status)) return { ...result, error: `stopped_http_${response.status}` };
      if (!response.ok) {
        if (attempt === 1 && response.status >= 500) {
          await delay(2_000);
          continue;
        }
        return { ...result, error: `http_${response.status}` };
      }
      const payload = await response.json();
      const valid = validate(payload);
      if (valid) await writeFile(cacheFile, `${JSON.stringify(payload)}\n`, "utf8");
      return { ...result, ok: valid, error: valid ? null : "unexpected_public_shape" };
    } catch (error) {
      if (attempt === 1) {
        await delay(2_000);
        continue;
      }
      return { kind, id, cacheHit: false, status: null, ok: false, error: error instanceof Error ? error.name : "request_failed" };
    }
  }
}

const checks = [];
for (const album of albums) {
  checks.push(await request("album", album.neteaseAlbumId, `https://music.163.com/api/album/${album.neteaseAlbumId}`, (payload) =>
    String(payload?.album?.id) === album.neteaseAlbumId &&
    typeof payload?.album?.name === "string" &&
    Array.isArray(payload?.songs) &&
    typeof payload?.album?.picUrl === "string"));
  await delay(2_000);
  if (checks.at(-1)?.error?.startsWith("stopped_http_")) break;
}
if (!checks.at(-1)?.error?.startsWith("stopped_http_")) {
  for (const artist of artists) {
    checks.push(await request("artist", artist.neteaseArtistId, `https://music.163.com/api/artist/albums/${artist.neteaseArtistId}?limit=1&offset=0`, (payload) =>
      Array.isArray(payload?.hotAlbums)));
    await delay(2_000);
    if (checks.at(-1)?.error?.startsWith("stopped_http_")) break;
  }
}
const afterCatalogSha256 = createHash("sha256").update(await readFile(catalogPath, "utf8")).digest("hex");
const report = {
  completedAt: new Date().toISOString(),
  status: checks.every((item) => item.ok) ? "PASS" : "PARTIAL",
  domain: "music.163.com",
  anonymous: true,
  cookieUsed: false,
  tokenUsed: false,
  authorizationUsed: false,
  requestedCount: checks.filter((item) => !item.cacheHit).length,
  cacheHitCount: checks.filter((item) => item.cacheHit).length,
  passedCount: checks.filter((item) => item.ok).length,
  failedCount: checks.filter((item) => !item.ok).length,
  stableCatalogUnchanged: catalogSha256 === afterCatalogSha256,
  checks,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
