import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertDiscoveryBaselineCurrent, classifyDiscoveryAlbumType, runDiscovery, validateDiscoveryCandidateArtifact } from "./discovery.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

const album = (id, name, type = "Album", artistId = 1, artistName = "Artist One") => ({ id, name, type, subType: "录音室版", size: type === "Single" ? 1 : 8, publishTime: Date.UTC(2026, 0, 1), artists: [{ id: artistId, name: artistName }] });

async function fixture({ artists = [{ neteaseArtistId: "1", name: "Artist One" }, { neteaseArtistId: "0", name: "Frozen Placeholder" }] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "discovery-v1-"));
  temporary.push(root);
  const generated = path.join(root, "production", "generated");
  await mkdir(generated, { recursive: true });
  const catalogPath = path.join(generated, "catalog.json");
  const artistIndexPath = path.join(generated, "artist-index.json");
  await writeFile(catalogPath, `${JSON.stringify({ version: 1, albums: [{ neteaseAlbumId: "10" }] })}\n`, "utf8");
  await writeFile(artistIndexPath, `${JSON.stringify({ version: 1, artists })}\n`, "utf8");
  return { root, catalogPath, artistIndexPath, workspaceRoot: path.join(root, ".local-data", "content-pipeline-v1") };
}

describe("Discovery Gateway V1", () => {
  it("classifies only source metadata and never guesses from titles", () => {
    expect(classifyDiscoveryAlbumType({ name: "LIVE greatest soundtrack", type: "Album", subType: "录音室版" })).toBe("album");
    expect(classifyDiscoveryAlbumType({ type: "EP" })).toBe("ep");
    expect(classifyDiscoveryAlbumType({ type: "Single" })).toBe("single");
    expect(classifyDiscoveryAlbumType({ type: "专辑", subType: "现场版" })).toBe("live");
  });

  it("paginates, merges sources, removes production duplicates, filters types, orders stably, limits NEW candidates, and replays cache", async () => {
    const f = await fixture();
    const fetchImpl = vi.fn(async (urlValue) => {
      const url = new URL(String(urlValue));
      if (url.pathname.includes("/api/artist/albums/")) {
        const offset = Number(url.searchParams.get("offset"));
        return new Response(JSON.stringify(offset === 0
          ? { code: 200, artist: { id: 1, name: "Artist One" }, hotAlbums: [album(10, "Existing"), album(20, "Twenty"), album(30, "Shared", "EP"), album(40, "Single", "Single")], more: true }
          : { code: 200, artist: { id: 1, name: "Artist One" }, hotAlbums: [album(21, "Twenty One")], more: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 200, total: 2, albums: [album(30, "Shared", "EP"), album(50, "Outside Artist", "Album", 5, "Artist Five")] }), { status: 200 });
    });
    const first = await runDiscovery({ ...f, fetchImpl, minimumGapMs: 0, delayImpl: async () => {}, limit: 2, now: () => new Date("2026-08-21T01:02:03.004Z") });
    expect(first).toMatchObject({ status: "DISCOVERY_COMPLETE", counts: { discovered: 6, sourceAppearances: 7, duplicatesAcrossSources: 1, existing: 1, newBeforeTypeFilter: 5, excludedByType: 1, eligibleBeforeLimit: 4, newCandidates: 2, truncatedByLimit: 2, failedSources: 0 }, invalidArtistSeeds: [{ neteaseArtistId: "0" }] });
    const candidate = validateDiscoveryCandidateArtifact(JSON.parse(await readFile(first.paths.candidate, "utf8")));
    expect(candidate.records.map((record) => record.album_id)).toEqual(["20", "21"]);
    expect(candidate.records[0]).toMatchObject({ core_genres: "", manual_verified: "false", discovery_album_type: "album" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const noNetwork = vi.fn(async () => { throw new Error("cache replay must not fetch"); });
    const replay = await runDiscovery({ ...f, fetchImpl: noNetwork, minimumGapMs: 0, delayImpl: async () => {}, limit: 2, now: () => new Date("2026-08-21T01:02:04.004Z") });
    expect(noNetwork).not.toHaveBeenCalled();
    expect(replay.fingerprint).toBe(first.fingerprint);
    expect(replay.candidateFingerprint).toBe(first.candidateFingerprint);
    expect(replay.network.cacheHits).toBe(3);
  });

  it("records refresh drift, binds candidate fingerprints, and rejects stale production baselines", async () => {
    const f = await fixture();
    let title = "Initial";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ code: 200, artist: { id: 1 }, hotAlbums: [album(20, title)], more: false }), { status: 200 }));
    const first = await runDiscovery({ ...f, fetchImpl, fromCurrentArtists: true, minimumGapMs: 0, delayImpl: async () => {}, now: () => new Date("2026-08-21T02:00:00.000Z") });
    expect(await assertDiscoveryBaselineCurrent(first.paths.candidate, f.catalogPath)).toMatchObject({ runId: first.runId, records: 1 });
    title = "Changed";
    const refreshed = await runDiscovery({ ...f, fetchImpl, fromCurrentArtists: true, refresh: true, minimumGapMs: 0, delayImpl: async () => {}, now: () => new Date("2026-08-21T02:01:00.000Z") });
    expect(refreshed.network.sourceDrift).toBe(1);
    await writeFile(f.catalogPath, `${JSON.stringify({ version: 2, albums: [{ neteaseAlbumId: "10" }, { neteaseAlbumId: "11" }] })}\n`, "utf8");
    await expect(assertDiscoveryBaselineCurrent(first.paths.candidate, f.catalogPath)).rejects.toMatchObject({ code: "STALE_DISCOVERY_BASELINE" });
  });

  it("backs off 429 finitely and isolates a throttled artist source", async () => {
    const f = await fixture({ artists: [{ neteaseArtistId: "1", name: "One" }, { neteaseArtistId: "2", name: "Two" }] });
    const delays = [];
    const fetchImpl = vi.fn(async () => new Response("throttled", { status: 429 }));
    const result = await runDiscovery({ ...f, fetchImpl, fromCurrentArtists: true, concurrency: 1, retries: 1, minimumGapMs: 0, delayImpl: async (milliseconds) => { delays.push(milliseconds); }, now: () => new Date("2026-08-21T03:00:00.000Z") });
    expect(result).toMatchObject({ status: "DISCOVERY_FAILED", counts: { failedSources: 1, discovered: 0 } });
    expect(result.sources[0]).toMatchObject({ artistsAttempted: 1, artistsSucceeded: 0, artistsFailed: 1, halted: true });
    expect(result.failures[0].code).toBe("DISCOVERY_THROTTLED");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([2000]);
  });

  it("continues after an ordinary Artist failure and reports a partial source result", async () => {
    const f = await fixture({ artists: [{ neteaseArtistId: "1", name: "One" }, { neteaseArtistId: "2", name: "Two" }] });
    const fetchImpl = vi.fn(async (urlValue) => String(urlValue).includes("/1?")
      ? new Response(JSON.stringify({ code: 404, artist: null, hotAlbums: null, more: null }), { status: 200 })
      : new Response(JSON.stringify({ code: 200, artist: { id: 2 }, hotAlbums: [album(22, "Twenty Two", "Album", 2, "Two")], more: false }), { status: 200 }));
    const result = await runDiscovery({ ...f, fetchImpl, fromCurrentArtists: true, concurrency: 1, retries: 0, minimumGapMs: 0, delayImpl: async () => {}, now: () => new Date("2026-08-21T04:00:00.000Z") });
    expect(result).toMatchObject({ status: "DISCOVERY_COMPLETE_WITH_FAILURES", counts: { discovered: 1, newCandidates: 1, failedSources: 1 } });
    expect(result.sources[0]).toMatchObject({ artistsAttempted: 2, artistsSucceeded: 1, artistsFailed: 1, halted: false });
    expect(result.failures[0].code).toBe("DISCOVERY_ARTIST_NOT_FOUND");
    const replayFetch = vi.fn(async () => { throw new Error("negative cache replay must not fetch"); });
    const replay = await runDiscovery({ ...f, fetchImpl: replayFetch, fromCurrentArtists: true, concurrency: 1, retries: 0, minimumGapMs: 0, delayImpl: async () => {}, now: () => new Date("2026-08-21T04:01:00.000Z") });
    expect(replayFetch).not.toHaveBeenCalled();
    expect(replay).toMatchObject({ status: "DISCOVERY_COMPLETE_WITH_FAILURES", network: { cacheHits: 2, networkRequests: 0 } });
  });

  it("fails an Artist safely when pagination never terminates before its guard", async () => {
    const f = await fixture();
    const fetchImpl = vi.fn(async (urlValue) => {
      const url = new URL(String(urlValue));
      const offset = Number(url.searchParams.get("offset"));
      return new Response(JSON.stringify({ code: 200, artist: { id: 1 }, hotAlbums: [album(100 + offset, `Page ${offset}`)], more: true }), { status: 200 });
    });
    const result = await runDiscovery({ ...f, fetchImpl, fromCurrentArtists: true, retries: 0, maximumArtistPages: 2, minimumGapMs: 0, delayImpl: async () => {}, now: () => new Date("2026-08-21T05:00:00.000Z") });
    expect(result).toMatchObject({ status: "DISCOVERY_FAILED", counts: { failedSources: 1 }, failures: [{ code: "ARTIST_PAGINATION_SAFETY_LIMIT" }] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
