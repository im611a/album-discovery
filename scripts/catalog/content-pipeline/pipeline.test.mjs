import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createBatchWorkspace, runDryRun } from "./pipeline.mjs";
import { sha256File, stableJson } from "./utils.mjs";

const run = promisify(execFile);
const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

const payload = (albumId, artistId, artistName) => ({
  album: { id: Number(albumId), name: "Synthetic Pipeline Collision", artists: [{ id: Number(artistId), name: artistName }], publishTime: Date.UTC(2026, 0, 1), type: "专辑", company: "Synthetic Fixture" },
  songs: [
    { id: Number(`${albumId}1`), name: "One", no: 1, cd: "1", dt: 1000, ar: [{ id: Number(artistId), name: artistName }] },
    { id: Number(`${albumId}2`), name: "Two", no: 2, cd: "1", dt: 1000, ar: [{ id: Number(artistId), name: artistName }] },
  ],
});

async function makeBatch(order = ["990001", "990002"]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-pipeline-dry-run-"));
  temporary.push(root);
  await createBatchWorkspace(root, { id: "CONTENT-BATCH-20260815-001", discoveredAt: "2026-08-15T00:00:00.000Z" });
  const input = ["album_id,expected_title,expected_artists,core_genres,contexts,cover_file,source_reference,discovered_at,slug_override,refresh"];
  for (const albumId of order) {
    const suffix = Number(albumId.slice(-1));
    const artistId = String(9_000_000_000 + suffix);
    const artist = `Synthetic Artist ${suffix}`;
    input.push(`${albumId},Synthetic Pipeline Collision,${artist},rock,focus,${albumId}.png,fixture,,,,false`);
    await writeFile(path.join(root, "input", "payloads", `${albumId}.json`), stableJson(payload(albumId, artistId, artist)), "utf8");
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=green:s=${80 + suffix * 2}x120`, "-frames:v", "1", path.join(root, "incoming-covers", `${albumId}.png`)], { windowsHide: true });
  }
  await writeFile(path.join(root, "input", "input.csv"), `${input.join("\n")}\n`, "utf8");
  return root;
}

describe("Content Pipeline dry-run integration", () => {
  it("is replayable, order-independent and production-mutation-free", async () => {
    const catalogPath = path.resolve("src/data/generated/catalog.json");
    const before = await sha256File(catalogPath);
    const firstRoot = await makeBatch();
    const first = await runDryRun({ batchRoot: firstRoot });
    const baseline = JSON.parse(await readFile(catalogPath, "utf8"));
    const candidate = JSON.parse(await readFile(path.join(firstRoot, "candidate", "generated", "catalog.json"), "utf8"));
    expect(first.report.records.map((record) => ({ id: record.albumId, disposition: record.disposition, findings: record.findings.map((item) => item.code) }))).toEqual([
      { id: "990001", disposition: "READY", findings: [] },
      { id: "990002", disposition: "READY", findings: [] },
    ]);
    expect(first.plan.records.map((record) => record.slug)).toEqual(["synthetic-pipeline-collision-990001", "synthetic-pipeline-collision-990002"]);
    expect(candidate.albums.slice(0, baseline.albums.length)).toEqual(baseline.albums);
    expect(first.plan.candidate.verification).toMatchObject({
      declaredTouchedAlbumIds: ["990001", "990002"],
      untouchedBaselineAlbums: baseline.albums.length,
      untouchedBaselineDrift: [],
    });
    expect(candidate.albums.slice(-2).map((album) => album.cover)).toEqual([
      expect.objectContaining({ src: "/catalog/covers/detail/990001.webp", thumbnailSrc: "/catalog/covers/thumb/990001.webp" }),
      expect.objectContaining({ src: "/catalog/covers/detail/990002.webp", thumbnailSrc: "/catalog/covers/thumb/990002.webp" }),
    ]);
    const repeated = await runDryRun({ batchRoot: firstRoot });
    expect(repeated.plan).toEqual(first.plan);
    expect(repeated.report.resultFingerprint).toBe(first.report.resultFingerprint);
    const repeatedAgain = await runDryRun({ batchRoot: firstRoot });
    expect(repeatedAgain.plan).toEqual(first.plan);
    expect(repeatedAgain.report.resultFingerprint).toBe(first.report.resultFingerprint);
    expect(repeatedAgain.plan.records.map((record) => record.destinationAssets)).toEqual(first.plan.records.map((record) => record.destinationAssets));
    const shuffledRoot = await makeBatch(["990002", "990001"]);
    const shuffled = await runDryRun({ batchRoot: shuffledRoot });
    expect(shuffled.plan).toEqual(first.plan);
    expect(await sha256File(catalogPath)).toBe(before);
    await expect(readFile(path.resolve("public/catalog/covers/detail/990001.webp"))).rejects.toMatchObject({ code: "ENOENT" });
  }, 60_000);
});
