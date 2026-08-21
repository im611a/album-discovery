import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireBatch } from "./acquisition.mjs";
import { createBatchWorkspace } from "./pipeline.mjs";

const run = promisify(execFile);
const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("Acquisition Gateway", () => {
  it("accounts HTTP, derives extension from decoded codec, caches, and preserves source defects", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-acquire-")); temporary.push(root);
    await createBatchWorkspace(root, { id: "CONTENT-BATCH-20260821-001", discoveredAt: "2026-08-21T00:00:00.000Z" });
    await writeFile(path.join(root, "input", "input.csv"), "album_id,expected_title,expected_artists,core_genres\n18934,Fixture,Artist,rock\n");
    const image = path.join(root, "fixture.png");
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=32x32", "-frames:v", "1", image], { windowsHide: true });
    const png = await readFile(image);
    const payload = { album: { id: 18934, picUrl: "https://p1.music.126.net/fake.jpg" }, songs: [{ cd: "1", no: 1 }, { cd: "1", no: 1 }] };
    const fetchImpl = vi.fn(async (url) => String(url).includes("/api/v1/album/") ? new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } }) : new Response(png, { status: 200, headers: { "content-type": "image/jpeg" } }));
    const report = await acquireBatch({ batchRoot: root, fetchImpl, retries: 0 });
    expect(report).toMatchObject({ requested: 1, acquired: 1, sourceDefects: 1 });
    expect(report.results[0]).toMatchObject({ cover: { file: "18934.png", codec: "png" }, accounting: { metadata: { redirectCount: 0 }, cover: { redirectCount: 0 } }, defects: [{ code: "SOURCE_PAYLOAD_DUPLICATE_POSITION", disposition: "DO_NOT_IMPORT" }] });
    const cached = await acquireBatch({ batchRoot: root, fetchImpl, retries: 0 });
    expect(cached).toMatchObject({ cacheHits: 1, acquired: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries transient GETs finitely and refuses to overwrite refresh drift", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-acquire-retry-")); temporary.push(root);
    await createBatchWorkspace(root, { id: "CONTENT-BATCH-20260821-002", discoveredAt: "2026-08-21T00:00:00.000Z" });
    await writeFile(path.join(root, "input", "input.csv"), "album_id,expected_title,expected_artists,core_genres\n990001,Fixture,Artist,rock\n");
    const image = path.join(root, "fixture.png");
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=32x32", "-frames:v", "1", image], { windowsHide: true });
    const png = await readFile(image);
    const base = { album: { id: 990001, name: "Original", picUrl: "https://p1.music.126.net/source.jpg" }, songs: [{ cd: "1", no: 1 }, { cd: "1", no: 2 }] };
    let calls = 0;
    const fetchImpl = vi.fn(async (url) => {
      calls += 1;
      if (calls === 1) return new Response("temporary", { status: 503 });
      if (calls === 2) return new Response(null, { status: 302, headers: { location: "/api/v1/album/990001?redirected=1" } });
      return String(url).includes("/api/v1/album/") ? new Response(JSON.stringify(base), { status: 200 }) : new Response(png, { status: 200 });
    });
    const acquired = await acquireBatch({ batchRoot: root, fetchImpl, retries: 1 });
    expect(acquired.results[0].accounting.metadata.attempts).toBe(2);
    expect(acquired.results[0].accounting.metadata.redirectCount).toBe(1);
    const before = acquired.results[0].payloadSha256;
    const changed = { ...base, album: { ...base.album, name: "Changed upstream" } };
    const refreshFetch = vi.fn(async (url) => String(url).includes("/api/v1/album/") ? new Response(JSON.stringify(changed), { status: 200 }) : new Response(png, { status: 200 }));
    const refreshed = await acquireBatch({ batchRoot: root, fetchImpl: refreshFetch, refresh: true, retries: 0 });
    expect(refreshed).toMatchObject({ refreshDrift: 1, acquired: 0, results: [{ status: "SOURCE_REFRESH_DRIFT" }] });
    expect(await import("./utils.mjs").then(({ sha256File }) => sha256File(path.join(root, "input", "payloads", "990001.json")))).toBe(before);
  });

  it("classifies timeout without retrying semantic defects", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-acquire-timeout-")); temporary.push(root);
    await createBatchWorkspace(root, { id: "CONTENT-BATCH-20260821-003", discoveredAt: "2026-08-21T00:00:00.000Z" });
    await writeFile(path.join(root, "input", "input.csv"), "album_id,expected_title,expected_artists,core_genres\n990002,Fixture,Artist,rock\n");
    const fetchImpl = vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    const report = await acquireBatch({ batchRoot: root, fetchImpl, timeoutMs: 10, retries: 0 });
    expect(report).toMatchObject({ failed: 1, results: [{ status: "FAILED", code: "ACQUISITION_TIMEOUT" }] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
