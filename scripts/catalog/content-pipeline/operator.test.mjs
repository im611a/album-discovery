import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createBatchWorkspace, directoryFingerprint } from "./pipeline.mjs";
import { parseOperatorArguments, runOperator } from "./operator.mjs";
import { sha256File, stableJson } from "./utils.mjs";

const temporary = [];
const run = promisify(execFile);
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));
const capture = () => { let value = ""; return { stream: { write(chunk) { value += chunk; } }, get value() { return value; } }; };

async function transactionFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "operator-transaction-")); temporary.push(root);
  const id = "CONTENT-BATCH-20260821-001";
  const batch = path.join(root, ".local-data", "content-pipeline-v1", id);
  const candidate = path.join(batch, "candidate");
  const input = path.join(batch, "input", "input.csv");
  await Promise.all([path.join(candidate, "generated"), path.join(candidate, "assets", "covers", "thumb"), path.join(candidate, "assets", "covers", "detail"), path.dirname(input), path.join(batch, "input", "payloads"), path.join(batch, "incoming-covers"), path.join(batch, "plan"), path.join(batch, "report"), path.join(batch, "operator"), path.join(root, "production", "generated"), path.join(root, "production", "covers")].map((directory) => mkdir(directory, { recursive: true })));
  await writeFile(input, "fixture\n");
  await writeFile(path.join(candidate, "generated", "catalog.json"), "after\n");
  await writeFile(path.join(candidate, "assets", "covers", "thumb", "123.webp"), "thumb\n");
  await writeFile(path.join(candidate, "assets", "covers", "detail", "123.webp"), "detail\n");
  await writeFile(path.join(root, "production", "generated", "catalog.json"), "before\n");
  const candidateFingerprint = (await directoryFingerprint(candidate)).fingerprint;
  const inputSha = await sha256File(input);
  const catalogSha = await sha256File(path.join(root, "production", "generated", "catalog.json"));
  await writeFile(path.join(batch, "batch.json"), stableJson({ id, input: "input/input.csv", discoveredAt: "2026-08-21T00:00:00.000Z" }));
  const planFile = path.join(batch, "plan", "plan.json");
  const reportFile = path.join(batch, "report", "report.json");
  await writeFile(planFile, stableJson({ baseline: { catalogFingerprint: "a".repeat(64), catalogSha256: catalogSha }, candidate: { fingerprint: candidateFingerprint }, readyAlbumIds: ["123"], review: { fingerprint: null } }));
  await writeFile(reportFile, stableJson({ input: { sha256: inputSha }, counts: { rowsTotal: 1, READY: 1, REJECTED_BY_REVIEW: 0, QUARANTINED: 0, SKIPPED_DUPLICATE: 0, NEEDS_REVIEW: 0, ERROR: 0, FATAL: 0, IMPORTED: 0 }, resultFingerprint: "b".repeat(64), records: [] }));
  const payloadFingerprint = (await directoryFingerprint(path.join(batch, "input", "payloads"))).fingerprint;
  const coverFingerprint = (await directoryFingerprint(path.join(batch, "incoming-covers"))).fingerprint;
  await writeFile(path.join(batch, "operator", "qualification.json"), stableJson({ schema: "content-pipeline-v1/operator-qualification/v1", batchId: id, inputSha256: inputSha, baselineCatalogSha256: catalogSha, payloadFingerprint, coverFingerprint, planSha256: await sha256File(planFile), reportSha256: await sha256File(reportFile), candidateFingerprint, resultFingerprint: "b".repeat(64), reviewFingerprint: null }));
  return { root, id, batch, candidateFingerprint };
}

async function pipelineFixture({ expectedTitle = "Operator End to End", invalidTrackList = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "operator-e2e-")); temporary.push(root);
  const id = "CONTENT-BATCH-20260821-002";
  const batch = path.join(root, ".local-data", "content-pipeline-v1", id);
  await Promise.all([mkdir(path.join(root, "production"), { recursive: true }), mkdir(path.join(root, "fixtures"), { recursive: true }), mkdir(path.join(root, "production", "covers"), { recursive: true })]);
  await cp(path.resolve("src/data/generated"), path.join(root, "production", "generated"), { recursive: true });
  await cp(path.resolve("scripts/catalog/netease-identities.json"), path.join(root, "fixtures", "netease-identities.json"));
  await cp(path.resolve("scripts/catalog/rym-taxonomy-snapshot.json"), path.join(root, "fixtures", "rym-taxonomy-snapshot.json"));
  await createBatchWorkspace(batch, { id, discoveredAt: "2026-08-21T00:00:00.000Z" });
  const albumId = "990099";
  const artistId = 9_090_099;
  const songs = [{ id: 9900991, name: "One", no: 1, cd: "1", dt: 1000, ar: [{ id: artistId, name: "Operator Fixture Artist" }] }, { id: 9900992, name: "Two", no: 2, cd: "1", dt: 1000, ar: [{ id: artistId, name: "Operator Fixture Artist" }] }];
  const payload = { album: { id: Number(albumId), name: "Operator End to End", artists: [{ id: artistId, name: "Operator Fixture Artist" }], publishTime: Date.UTC(2026, 0, 2), type: "专辑", company: "Fixture" }, songs: invalidTrackList ? songs.slice(0, 1) : songs };
  await writeFile(path.join(batch, "input", "input.csv"), `album_id,expected_title,expected_artists,core_genres,cover_file\n${albumId},${expectedTitle},Operator Fixture Artist,rock,${albumId}.png\n`);
  await writeFile(path.join(batch, "input", "payloads", `${albumId}.json`), stableJson(payload));
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=purple:s=96x128", "-frames:v", "1", path.join(batch, "incoming-covers", `${albumId}.png`)], { windowsHide: true });
  return { root, id, batch };
}

async function hardeningFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "operator-hardening-")); temporary.push(root);
  const id = "CONTENT-BATCH-20260822-001";
  const batch = path.join(root, ".local-data", "content-pipeline-v1", id);
  await Promise.all([mkdir(path.join(batch, "input", "payloads"), { recursive: true }), mkdir(path.join(batch, "incoming-covers"), { recursive: true }), mkdir(path.join(batch, "acquisition"), { recursive: true }), mkdir(path.join(root, "production", "generated"), { recursive: true })]);
  const records = ["10", "11", "12"].map((albumId) => ({ album_id: albumId, expected_title: `Album ${albumId}`, expected_artists: albumId === "12" ? "Missing" : "Known", core_genres: "", manual_verified: "false" }));
  await writeFile(path.join(batch, "input", "input.json"), stableJson({ records }));
  await writeFile(path.join(batch, "batch.json"), stableJson({ id, input: "input/input.json", discoveredAt: "2026-08-22T00:00:00.000Z" }));
  for (const [albumId, artistId] of [["10", 1], ["11", 1]]) { await writeFile(path.join(batch, "input", "payloads", `${albumId}.json`), stableJson({ album: { id: Number(albumId), name: `Album ${albumId}`, artists: [{ id: artistId, name: "Known" }] } })); await writeFile(path.join(batch, "incoming-covers", `${albumId}.png`), `cover-${albumId}`); }
  const acquired = async (albumId, defects = []) => ({ albumId, status: "ACQUIRED", payloadSha256: await sha256File(path.join(batch, "input", "payloads", `${albumId}.json`)), cover: { sha256: await sha256File(path.join(batch, "incoming-covers", `${albumId}.png`)) }, defects });
  await writeFile(path.join(batch, "acquisition", "report.json"), stableJson({ schema: "content-pipeline-v1/acquisition/v1", batchId: id, requested: 3, acquired: 2, failed: 1, sourceDefects: 1, cacheHits: 0, refreshDrift: 0, results: [await acquired("10"), await acquired("11", [{ code: "SOURCE_PAYLOAD_DUPLICATE_POSITION", disposition: "DO_NOT_IMPORT", positions: ["1:1"] }]), { albumId: "12", status: "FAILED", code: "ACQUISITION_HTTP_ERROR", message: "ACQUISITION_HTTP_ERROR: 404" }] }));
  await writeFile(path.join(root, "production", "generated", "catalog.json"), stableJson({ taxonomy: [{ key: "rock", kind: "core" }], albums: [{ neteaseAlbumId: "1", title: "Known baseline", coreGenres: ["rock"], artists: [{ neteaseArtistId: "1", name: "Known" }] }] }));
  await writeFile(path.join(root, "production", "generated", "artist-index.json"), stableJson({ artists: [] }));
  return { root, id, batch };
}

describe("Bulk Operator command contract", () => {
  it("fails closed on unknown and missing options", () => {
    expect(() => parseOperatorArguments(["status", "--wat"])).toThrow(/UNKNOWN_OPTION/u);
    expect(() => parseOperatorArguments(["status", "--batch"])).toThrow(/MISSING_OPTION_VALUE/u);
    expect(() => parseOperatorArguments(["discover", "--limit"])).toThrow(/MISSING_OPTION_VALUE/u);
  });

  it("routes cached discovery, emits a directly acquirable artifact, and rejects a stale discovery baseline", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-discovery-")); temporary.push(root);
    const generated = path.join(root, "production", "generated");
    const legacyCache = path.join(root, ".cache", "catalog", "netease");
    await Promise.all([mkdir(generated, { recursive: true }), mkdir(legacyCache, { recursive: true })]);
    const catalogFile = path.join(generated, "catalog.json");
    await writeFile(catalogFile, `${JSON.stringify({ version: 1, albums: [] })}\n`, "utf8");
    await writeFile(path.join(generated, "artist-index.json"), `${JSON.stringify({ version: 1, artists: [{ neteaseArtistId: "1", name: "Discovery Artist" }] })}\n`, "utf8");
    await writeFile(path.join(legacyCache, "artist-albums-1-0.json"), `${JSON.stringify({ code: 200, artist: { id: 1, name: "Discovery Artist" }, hotAlbums: [{ id: 20, name: "Discovered Album", type: "Album", subType: "录音室版", size: 8, artists: [{ id: 1, name: "Discovery Artist" }] }], more: false })}\n`, "utf8");
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: root };
    const stdout = capture();
    expect(await runOperator(["discover", "--artist-limit", "1", "--from-current-artists", "--limit", "1", "--json"], { stdout: stdout.stream, stderr: capture().stream, environment })).toBe(0);
    const discovered = JSON.parse(stdout.value);
    expect(discovered).toMatchObject({ command: "discover", status: "DISCOVERY_COMPLETE", counts: { discovered: 1, existing: 0, newCandidates: 1 }, productionMutation: false });
    const candidate = JSON.parse(await readFile(discovered.artifacts.candidate, "utf8"));
    expect(candidate.records).toEqual([expect.objectContaining({ album_id: "20", core_genres: "", manual_verified: "false" })]);
    await writeFile(catalogFile, `${JSON.stringify({ version: 2, albums: [{ neteaseAlbumId: "10" }] })}\n`, "utf8");
    const stale = capture();
    expect(await runOperator(["acquire", "--input", discovered.artifacts.candidate, "--json"], { stdout: stale.stream, stderr: capture().stream, environment })).toBe(6);
    expect(JSON.parse(stale.value)).toMatchObject({ status: "FAILED", exitCategory: "preflight", errors: [{ code: "STALE_DISCOVERY_BASELINE" }] });
  });

  it("emits exactly one JSON envelope", async () => {
    const stdout = capture(); const stderr = capture();
    expect(await runOperator(["help", "--json"], { stdout: stdout.stream, stderr: stderr.stream })).toBe(0);
    expect(JSON.parse(stdout.value)).toMatchObject({ schema: "content-pipeline-v1/operator-result/v1", command: "help", status: "HELP" });
    expect(stderr.value).toBe("");
  });

  it("finalizes partial acquisition and exports grouped taxonomy without network or production mutation", async () => {
    const fixture = await hardeningFixture();
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
    const productionFile = path.join(fixture.root, "production", "generated", "catalog.json");
    const productionBefore = await sha256File(productionFile);
    const finalized = capture();
    expect(await runOperator(["finalize-acquisition", "--batch", fixture.id, "--json"], { stdout: finalized.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(finalized.value)).toMatchObject({ status: "ACQUISITION_USABLE", counts: { requested: 3, clean: 1, doNotImport: 1, unavailable: 1, unresolvedBlocking: 0 }, cleanReuse: { acquisitionRequests: 0, copiedArtifacts: 0 } });
    const taxonomy = capture();
    expect(await runOperator(["taxonomy", "--batch", fixture.id, "--json"], { stdout: taxonomy.stream, stderr: capture().stream, environment })).toBe(5);
    expect(JSON.parse(taxonomy.value)).toMatchObject({ status: "TAXONOMY_REVIEW_REQUIRED", counts: { albums: 1, highConfidenceAlbums: 1, groups: 1 }, confidence: "PROPOSED_NOT_HUMAN_ACCEPTED" });
    const status = capture();
    expect(await runOperator(["status", "--batch", fixture.id, "--json"], { stdout: status.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(status.value)).toMatchObject({ status: "AWAITING_TAXONOMY_REVIEW", acquisitionUsable: true });
    expect(await sha256File(productionFile)).toBe(productionBefore);
  });

  it("rejects known options that are irrelevant to a command", async () => {
    const stdout = capture();
    expect(await runOperator(["doctor", "--batch", "CONTENT-BATCH-20260821-001", "--json"], { stdout: stdout.stream, stderr: capture().stream })).toBe(2);
    expect(JSON.parse(stdout.value)).toMatchObject({ status: "FAILED", exitCategory: "usage", errors: [{ code: "OPTION_NOT_VALID_FOR_COMMAND" }] });
  });

  it("requires exact authorization and promotes only temporary production", async () => {
    const fixture = await transactionFixture();
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
    const prepareOut = capture();
    expect(await runOperator(["prepare", "--batch", fixture.id, "--json"], { stdout: prepareOut.stream, stderr: capture().stream, environment })).toBe(0);
    const prepared = JSON.parse(prepareOut.value);
    expect(prepared).toMatchObject({ status: "PREPARED", operations: 3 });
    const rejected = capture();
    expect(await runOperator(["promote", "--batch", fixture.id, "--transaction", "wrong", "--candidate-fingerprint", fixture.candidateFingerprint, "--json"], { stdout: rejected.stream, stderr: capture().stream, environment })).toBe(7);
    const promoted = capture();
    expect(await runOperator(["promote", "--batch", fixture.id, "--transaction", prepared.transactionId, "--candidate-fingerprint", fixture.candidateFingerprint, "--json"], { stdout: promoted.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(promoted.value).status).toBe("COMMITTED");
    expect(await readFile(path.join(fixture.root, "production", "generated", "catalog.json"), "utf8")).toBe("after\n");
  });

  it("recovers an interrupted non-terminal journal through the operator and is idempotent", async () => {
    const fixture = await transactionFixture();
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
    const prepareOut = capture();
    expect(await runOperator(["prepare", "--batch", fixture.id, "--json"], { stdout: prepareOut.stream, stderr: capture().stream, environment })).toBe(0);
    const journalFile = path.join(fixture.batch, "transaction", "journal.json");
    const journal = JSON.parse(await readFile(journalFile, "utf8"));
    journal.state = "PROMOTING";
    await writeFile(journalFile, stableJson(journal));
    const recovered = capture();
    expect(await runOperator(["recover", "--batch", fixture.id, "--json"], { stdout: recovered.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(recovered.value)).toMatchObject({ status: "ROLLED_BACK", action: "ROLLED_BACK_TO_BEFORE" });
    const repeated = capture();
    expect(await runOperator(["recover", "--batch", fixture.id, "--json"], { stdout: repeated.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(repeated.value)).toMatchObject({ status: "ROLLED_BACK", action: "NO_OP_ROLLED_BACK" });
  });

  it("runs dry-run, status, review, prepare and promote end-to-end on isolated production", async () => {
    const fixture = await pipelineFixture();
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
    const dryRun = capture();
    expect(await runOperator(["dry-run", "--batch", fixture.id, "--json"], { stdout: dryRun.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(dryRun.value)).toMatchObject({ status: "DRY_RUN_COMPLETE", counts: { READY: 1, ERROR: 0, FATAL: 0 } });
    const status = capture();
    expect(await runOperator(["status", "--batch", fixture.id, "--json"], { stdout: status.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(status.value).status).toBe("PROMOTABLE");
    const review = capture();
    expect(await runOperator(["review", "--batch", fixture.id, "--json"], { stdout: review.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(review.value).status).toBe("REVIEW_EXPORTED");
    const prepare = capture();
    expect(await runOperator(["prepare", "--batch", fixture.id, "--json"], { stdout: prepare.stream, stderr: capture().stream, environment })).toBe(0);
    const prepared = JSON.parse(prepare.value);
    const promote = capture();
    expect(await runOperator(["promote", "--batch", fixture.id, "--transaction", prepared.transactionId, "--candidate-fingerprint", prepared.fingerprints.candidate, "--json"], { stdout: promote.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(promote.value).status).toBe("COMMITTED");
    const catalog = JSON.parse(await readFile(path.join(fixture.root, "production", "generated", "catalog.json"), "utf8"));
    expect(catalog.albums.some((album) => album.neteaseAlbumId === "990099")).toBe(true);
  }, 120_000);

  it("binds human review to batch/input, invalidates qualification, and requires a rerun", async () => {
    const fixture = await pipelineFixture({ expectedTitle: "Human Assertion Differs" });
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
    const initial = capture();
    expect(await runOperator(["dry-run", "--batch", fixture.id, "--json"], { stdout: initial.stream, stderr: capture().stream, environment })).toBe(5);
    expect(JSON.parse(initial.value)).toMatchObject({ status: "QUALIFICATION_BLOCKED", counts: { NEEDS_REVIEW: 1 } });
    const exported = capture();
    expect(await runOperator(["review", "--batch", fixture.id, "--json"], { stdout: exported.stream, stderr: capture().stream, environment })).toBe(5);
    const template = JSON.parse(await readFile(JSON.parse(exported.value).artifacts.template, "utf8"));
    template.decisions = template.decisions.map((decision) => ({ ...decision, decision: "ACCEPT" }));
    const decisions = path.join(fixture.root, "review decisions.json");
    await writeFile(decisions, stableJson(template));
    const applied = capture();
    expect(await runOperator(["review", "--batch", fixture.id, "--apply", decisions, "--json"], { stdout: applied.stream, stderr: capture().stream, environment })).toBe(0);
    const invalidated = capture();
    expect(await runOperator(["status", "--batch", fixture.id, "--json"], { stdout: invalidated.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(invalidated.value)).toMatchObject({ status: "NOT_PROMOTABLE", warnings: ["REVIEW_DRIFT"] });
    const rerun = capture();
    expect(await runOperator(["dry-run", "--batch", fixture.id, "--json"], { stdout: rerun.stream, stderr: capture().stream, environment })).toBe(0);
    expect(JSON.parse(rerun.value)).toMatchObject({ status: "DRY_RUN_COMPLETE", counts: { READY: 1, NEEDS_REVIEW: 0 } });
  }, 60_000);

  it("applies formal REJECT and deterministic quarantine without production or network mutation", async () => {
    for (const scenario of ["REJECT", "QUARANTINE"]) {
      const fixture = await pipelineFixture(scenario === "REJECT" ? { expectedTitle: "Human Assertion Differs" } : { invalidTrackList: true });
      const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
      const productionFile = path.join(fixture.root, "production", "generated", "catalog.json");
      const productionBefore = await sha256File(productionFile);
      const initial = capture();
      expect(await runOperator(["dry-run", "--batch", fixture.id, "--json"], { stdout: initial.stream, stderr: capture().stream, environment })).toBe(scenario === "REJECT" ? 5 : 6);
      const exported = capture();
      expect(await runOperator(["review", "--batch", fixture.id, "--json"], { stdout: exported.stream, stderr: capture().stream, environment })).toBe(5);
      const template = JSON.parse(await readFile(JSON.parse(exported.value).artifacts.template, "utf8"));
      if (scenario === "REJECT") template.decisions = template.decisions.map((decision) => ({ ...decision, decision: "REJECT" }));
      else template.quarantines = template.quarantines.map((decision) => ({ ...decision, decision: "QUARANTINE" }));
      const artifact = path.join(fixture.root, `${scenario.toLocaleLowerCase("en-US")}-decisions.json`);
      await writeFile(artifact, stableJson(template));
      const applied = capture();
      expect(await runOperator(["review", "--batch", fixture.id, "--apply", artifact, "--json"], { stdout: applied.stream, stderr: capture().stream, environment })).toBe(0);
      expect(JSON.parse(applied.value)).toMatchObject({ counts: scenario === "REJECT" ? { accepted: 0, rejected: 1, quarantined: 0 } : { accepted: 0, rejected: 0, quarantined: 1 } });
      const rerun = capture();
      expect(await runOperator(["dry-run", "--batch", fixture.id, "--json"], { stdout: rerun.stream, stderr: capture().stream, environment })).toBe(0);
      expect(JSON.parse(rerun.value)).toMatchObject({ status: "DRY_RUN_COMPLETE", counts: scenario === "REJECT" ? { READY: 0, REJECTED_BY_REVIEW: 1, NEEDS_REVIEW: 0, ERROR: 0, FATAL: 0 } : { READY: 0, QUARANTINED: 1, NEEDS_REVIEW: 0, ERROR: 0, FATAL: 0 }, networkRequests: 0 });
      expect(await sha256File(productionFile)).toBe(productionBefore);
    }
  }, 60_000);

  it("blocks prepare after production baseline or candidate drift", async () => {
    const fixture = await pipelineFixture();
    const environment = { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: fixture.root };
    expect(await runOperator(["dry-run", "--batch", fixture.id, "--json"], { stdout: capture().stream, stderr: capture().stream, environment })).toBe(0);
    const productionFile = path.join(fixture.root, "production", "generated", "catalog.json");
    const productionBytes = await readFile(productionFile);
    await writeFile(productionFile, Buffer.concat([productionBytes, Buffer.from("\n")]));
    const baselineBlocked = capture();
    expect(await runOperator(["prepare", "--batch", fixture.id, "--json"], { stdout: baselineBlocked.stream, stderr: capture().stream, environment })).toBe(6);
    expect(JSON.parse(baselineBlocked.value).message).toMatch(/BASELINE_DRIFT/u);
    await writeFile(productionFile, productionBytes);
    const candidateFile = path.join(fixture.batch, "candidate", "generated", "catalog.json");
    await writeFile(candidateFile, Buffer.concat([await readFile(candidateFile), Buffer.from("\n")]));
    const candidateBlocked = capture();
    expect(await runOperator(["prepare", "--batch", fixture.id, "--json"], { stdout: candidateBlocked.stream, stderr: capture().stream, environment })).toBe(6);
    expect(JSON.parse(candidateBlocked.value).message).toMatch(/CANDIDATE_DRIFT/u);
  }, 60_000);
});
