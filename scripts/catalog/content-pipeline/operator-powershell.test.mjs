import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { sha256File, stableJson } from "./utils.mjs";

const run = promisify(execFile);
const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function available(program) {
  try { await run(program, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], { windowsHide: true }); return true; } catch { return false; }
}

describe("PowerShell thin wrapper", () => {
  for (const program of ["powershell", "pwsh"]) it(`${program} forwards Unicode/special paths, JSON and exit codes outside the repository cwd`, async ({ skip }) => {
    if (!(await available(program))) skip();
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-ps-")); temporary.push(root);
    const outside = path.join(root, "outside cwd");
    const inputRoot = path.join(root, "输入 & () []");
    await Promise.all([mkdir(outside, { recursive: true }), mkdir(inputRoot, { recursive: true })]);
    const input = path.join(inputRoot, "专辑 & sample.csv");
    await writeFile(input, "album_id,expected_title,expected_artists,core_genres\n", "utf8");
    const script = path.resolve("album-import.ps1");
    const arguments_ = program === "powershell" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "acquire", "-Input", input, "-Json"] : ["-NoProfile", "-File", script, "acquire", "-Input", input, "-Json"];
    const result = await run(program, arguments_, { cwd: outside, windowsHide: true, env: { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: root } });
    expect(JSON.parse(result.stdout)).toMatchObject({ command: "acquire", status: "ACQUISITION_COMPLETE", counts: { requested: 0 } });
    expect(result.stderr).toBe("");
  }, 30_000);

  for (const program of ["powershell", "pwsh"]) it(`${program} forwards discover limit/source switches and JSON without duplicating discovery logic`, async ({ skip }) => {
    if (!(await available(program))) skip();
    const parent = await mkdtemp(path.join(os.tmpdir(), "operator-ps-discovery-")); temporary.push(parent);
    const root = path.join(parent, "发现 & []");
    const generated = path.join(root, "production", "generated");
    const legacyCache = path.join(root, ".cache", "catalog", "netease");
    const outside = path.join(parent, "outside cwd");
    await Promise.all([mkdir(generated, { recursive: true }), mkdir(legacyCache, { recursive: true }), mkdir(outside, { recursive: true })]);
    await writeFile(path.join(generated, "catalog.json"), `${JSON.stringify({ version: 1, albums: [] })}\n`, "utf8");
    await writeFile(path.join(generated, "artist-index.json"), `${JSON.stringify({ version: 1, artists: [{ neteaseArtistId: "1", name: "发现艺人" }] })}\n`, "utf8");
    await writeFile(path.join(legacyCache, "artist-albums-1-0.json"), `${JSON.stringify({ code: 200, artist: { id: 1, name: "发现艺人" }, hotAlbums: [{ id: 20, name: "发现专辑", type: "Album", subType: "录音室版", size: 8, artists: [{ id: 1, name: "发现艺人" }] }], more: false })}\n`, "utf8");
    const script = path.resolve("album-import.ps1");
    const arguments_ = program === "powershell"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "discover", "-Limit", "1", "-ArtistLimit", "1", "-FromCurrentArtists", "-Json"]
      : ["-NoProfile", "-File", script, "discover", "-Limit", "1", "-ArtistLimit", "1", "-FromCurrentArtists", "-Json"];
    const result = await run(program, arguments_, { cwd: outside, windowsHide: true, env: { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: root } });
    expect(JSON.parse(result.stdout)).toMatchObject({ command: "discover", status: "DISCOVERY_COMPLETE", counts: { newCandidates: 1 }, network: { networkRequests: 0, legacyCacheHits: 1 }, productionMutation: false });
    expect(result.stderr).toBe("");
  }, 30_000);

  for (const program of ["powershell", "pwsh"]) it(`${program} forwards finalize-acquisition and taxonomy as local-only commands`, async ({ skip }) => {
    if (!(await available(program))) skip();
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-ps-hardening-")); temporary.push(root);
    const id = "CONTENT-BATCH-20260822-001";
    const batch = path.join(root, ".local-data", "content-pipeline-v1", id);
    const payload = path.join(batch, "input", "payloads", "10.json");
    const cover = path.join(batch, "incoming-covers", "10.png");
    await Promise.all([mkdir(path.dirname(payload), { recursive: true }), mkdir(path.dirname(cover), { recursive: true }), mkdir(path.join(batch, "acquisition"), { recursive: true }), mkdir(path.join(root, "production", "generated"), { recursive: true })]);
    await writeFile(path.join(batch, "input", "input.json"), stableJson({ records: [{ album_id: "10", expected_title: "十", expected_artists: "艺人", core_genres: "" }] }));
    await writeFile(path.join(batch, "batch.json"), stableJson({ id, input: "input/input.json", discoveredAt: "2026-08-22T00:00:00.000Z" }));
    await writeFile(payload, stableJson({ album: { id: 10, name: "十", artists: [{ id: 1, name: "艺人" }] } }));
    await writeFile(cover, "cover");
    await writeFile(path.join(batch, "acquisition", "report.json"), stableJson({ schema: "content-pipeline-v1/acquisition/v1", batchId: id, requested: 1, acquired: 1, failed: 0, sourceDefects: 0, cacheHits: 0, refreshDrift: 0, results: [{ albumId: "10", status: "ACQUIRED", payloadSha256: await sha256File(payload), cover: { sha256: await sha256File(cover) }, defects: [] }] }));
    await writeFile(path.join(root, "production", "generated", "catalog.json"), stableJson({ taxonomy: [{ key: "rock", kind: "core" }], albums: [{ neteaseAlbumId: "1", title: "旧", coreGenres: ["rock"], artists: [{ neteaseArtistId: "1", name: "艺人" }] }] }));
    await writeFile(path.join(root, "production", "generated", "artist-index.json"), stableJson({ artists: [] }));
    const script = path.resolve("album-import.ps1");
    const psArgs = (command) => program === "powershell" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, command, "-Batch", id, "-Json"] : ["-NoProfile", "-File", script, command, "-Batch", id, "-Json"];
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: root };
    const finalized = await run(program, psArgs("finalize-acquisition"), { windowsHide: true, env: environment });
    expect(JSON.parse(finalized.stdout)).toMatchObject({ status: "ACQUISITION_USABLE", counts: { clean: 1 }, networkRequests: 0 });
    let taxonomy;
    try { await run(program, psArgs("taxonomy"), { windowsHide: true, env: environment }); }
    catch (error) { taxonomy = error; }
    expect(taxonomy?.code).toBe(5);
    expect(JSON.parse(taxonomy.stdout)).toMatchObject({ status: "TAXONOMY_REVIEW_REQUIRED", counts: { highConfidenceGroups: 1 }, networkRequests: 0 });
  }, 30_000);
});
