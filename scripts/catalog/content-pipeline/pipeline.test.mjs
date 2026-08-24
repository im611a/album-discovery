import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { applyReviewOverlayToRecords, createBatchWorkspace, isolateCandidateIdentityConflicts, runDryRun } from "./pipeline.mjs";
import { REVIEW_SCHEMA, validateReviewDecisionArtifact } from "./review.mjs";
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
  it("isolates production-to-candidate and candidate-to-candidate identity conflicts without poisoning clean rows", () => {
    const album = (albumId, artistId, title, releaseDate) => ({ neteaseAlbumId: albumId, artists: [{ neteaseArtistId: artistId }], title, releaseDate });
    const record = (rowNumber, value) => ({
      rowNumber,
      albumId: value.neteaseAlbumId,
      album: value,
      disposition: "READY",
      findings: [],
      duplicate: { state: "DISTINCT" },
    });
    const cleanRecords = Array.from({ length: 100 }, (_, index) => record(index + 1, album(String(10_000 + index), String(20_000 + index), `Independent ${index}`, "2022-01-01")));
    const records = [...cleanRecords,
      record(101, album("101", "10", "Production Match", "2020-08-01")),
      record(102, album("102", "20", "Candidate Match", "2021-01-01")),
      record(103, album("103", "20", "Candidate Match", "2021-12-31")),
    ];
    const conflicts = isolateCandidateIdentityConflicts(records, [album("1", "10", "Production Match", "2020-02-02")]);
    expect(conflicts).toEqual([
      expect.objectContaining({ identityKey: "10:productionmatch:2020", conflictScope: "PRODUCTION_TO_CANDIDATE" }),
      expect.objectContaining({ identityKey: "20:candidatematch:2021", conflictScope: "CANDIDATE_TO_CANDIDATE" }),
    ]);
    expect(records.filter((item) => item.disposition === "NEEDS_REVIEW").map((item) => ({ id: item.albumId, codes: item.findings.map((finding) => finding.code) }))).toEqual([
      { id: "101", codes: ["CANDIDATE_IDENTITY_CONFLICT"] },
      { id: "102", codes: ["CANDIDATE_IDENTITY_CONFLICT"] },
      { id: "103", codes: ["CANDIDATE_IDENTITY_CONFLICT"] },
    ]);
    expect(records.filter((item) => item.disposition === "READY")).toHaveLength(100);
    expect(records.filter((item) => item.disposition === "READY").every((item) => item.findings.length === 0)).toBe(true);
    expect(records.filter((item) => item.disposition === "READY").map((item) => item.albumId)).not.toEqual(expect.arrayContaining(["101", "102", "103"]));
    expect(records.flatMap((item) => item.findings).some((finding) => finding.level === "FATAL")).toBe(false);
    const replayRecords = structuredClone([...cleanRecords,
      record(101, album("101", "10", "Production Match", "2020-08-01")),
      record(102, album("102", "20", "Candidate Match", "2021-01-01")),
      record(103, album("103", "20", "Candidate Match", "2021-12-31")),
    ]);
    expect(isolateCandidateIdentityConflicts(replayRecords, [album("1", "10", "Production Match", "2020-02-02")])).toEqual(conflicts);
  });

  it("resolves production and candidate identity conflicts only through an explicit valid selection", () => {
    const album = (albumId, artistId, title, releaseDate) => ({ neteaseAlbumId: albumId, artists: [{ neteaseArtistId: artistId }], title, releaseDate });
    const record = (rowNumber, value) => ({ rowNumber, albumId: value.neteaseAlbumId, album: value, disposition: "READY", findings: [], duplicate: { state: "DISTINCT" } });
    const production = [album("1", "10", "Production Match", "2020-02-02")];
    const makeRecords = () => [
      record(1, album("101", "10", "Production Match", "2020-08-01")),
      record(2, album("102", "20", "Candidate Match", "2021-01-01")),
      record(3, album("103", "20", "Candidate Match", "2021-12-31")),
      record(4, album("104", "30", "Independent", "2022-01-01")),
    ];
    const context = { batchId: "CONTENT-BATCH-20260815-001", inputSha256: "a".repeat(64), albumIds: ["101", "102", "103", "104"] };
    const records = makeRecords();
    isolateCandidateIdentityConflicts(records, production);
    const selected = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [
      { albumId: "101", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "REJECT" },
      { albumId: "102", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "REJECT" },
      { albumId: "103", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "ACCEPT" },
    ] }, context);
    expect(applyReviewOverlayToRecords(records, selected, production).hardConflicts).toEqual([]);
    expect(records.map((item) => [item.albumId, item.disposition])).toEqual([["101", "REJECTED_BY_REVIEW"], ["102", "REJECTED_BY_REVIEW"], ["103", "READY"], ["104", "READY"]]);
    expect(records[0].findings[0]).toMatchObject({ code: "HUMAN_REVIEW_REJECTED", originalFinding: { code: "CANDIDATE_IDENTITY_CONFLICT" } });

    const invalidSelection = makeRecords();
    isolateCandidateIdentityConflicts(invalidSelection, production);
    const acceptedAll = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [
      { albumId: "101", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "ACCEPT" },
      { albumId: "102", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "ACCEPT" },
      { albumId: "103", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "ACCEPT" },
    ] }, context);
    expect(applyReviewOverlayToRecords(invalidSelection, acceptedAll, production).hardConflicts).toHaveLength(2);
    expect(invalidSelection.slice(0, 3).every((item) => item.disposition === "FATAL" && item.findings.some((finding) => finding.code === "CANDIDATE_IDENTITY_CONFLICT_UNRESOLVED"))).toBe(true);
    expect(invalidSelection[3].disposition).toBe("READY");
  });

  it("quarantines only whitelisted deterministic row errors and leaves unknown errors blocking", () => {
    const records = [
      { rowNumber: 1, albumId: "201", album: null, disposition: "ERROR", findings: [{ level: "ERROR", code: "invalid_track_list", message: "No complete track list." }], duplicate: { state: "DISTINCT" } },
      { rowNumber: 2, albumId: "202", album: null, disposition: "ERROR", findings: [{ level: "ERROR", code: "UNKNOWN_ERROR", message: "Unknown." }], duplicate: { state: "DISTINCT" } },
    ];
    const overlay = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: "CONTENT-BATCH-20260815-001", inputSha256: "a".repeat(64), decisions: [], quarantines: [{ albumId: "201", code: "invalid_track_list", decision: "QUARANTINE" }] }, { batchId: "CONTENT-BATCH-20260815-001", inputSha256: "a".repeat(64), albumIds: ["201", "202"] });
    applyReviewOverlayToRecords(records, overlay, []);
    expect(records[0]).toMatchObject({ disposition: "QUARANTINED", findings: [{ code: "QUARANTINED_INVALID_SOURCE_DATA", originalFinding: { code: "invalid_track_list", message: "No complete track list." } }] });
    expect(records[1]).toMatchObject({ disposition: "ERROR", findings: [{ code: "UNKNOWN_ERROR" }] });
  });

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
  }, 120_000);
});
