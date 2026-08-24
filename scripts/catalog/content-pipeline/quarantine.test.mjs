import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { finalizeAcquisition } from "./quarantine.mjs";
import { sha256File, stableJson } from "./utils.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "quarantine-")); temporary.push(root);
  await Promise.all(["input/payloads", "incoming-covers", "acquisition"].map((directory) => mkdir(path.join(root, directory), { recursive: true })));
  const records = ["1", "2", "3", "4"].map((id) => ({ album_id: id, expected_title: `Album ${id}`, expected_artists: "Artist", core_genres: "", manual_verified: "false" }));
  await writeFile(path.join(root, "input", "input.json"), stableJson({ records }));
  await writeFile(path.join(root, "batch.json"), stableJson({ id: "CONTENT-BATCH-20260822-001", discoveredAt: "2026-08-22T00:00:00.000Z", input: "input/input.json" }));
  for (const id of ["1", "2", "3"]) { await writeFile(path.join(root, "input", "payloads", `${id}.json`), stableJson({ album: { id: Number(id) } })); await writeFile(path.join(root, "incoming-covers", `${id}.png`), `cover-${id}`); }
  const clean = async (id) => ({ albumId: id, status: "ACQUIRED", payloadSha256: await sha256File(path.join(root, "input", "payloads", `${id}.json`)), cover: { sha256: await sha256File(path.join(root, "incoming-covers", `${id}.png`)) }, rawResponse: { file: `acquisition/raw/${id}.json`, sha256: id.repeat(64).slice(0, 64) }, defects: [] });
  const results = [await clean("1"), { ...(await clean("2")), defects: [{ code: "SOURCE_PAYLOAD_DUPLICATE_POSITION", disposition: "DO_NOT_IMPORT", positions: ["1:1"] }] }, await clean("3"), { albumId: "4", status: "FAILED", code: "ACQUISITION_HTTP_ERROR", message: "ACQUISITION_HTTP_ERROR: 404" }];
  await writeFile(path.join(root, "acquisition", "report.json"), stableJson({ schema: "content-pipeline-v1/acquisition/v1", batchId: "CONTENT-BATCH-20260822-001", requested: 4, acquired: 3, failed: 1, sourceDefects: 1, cacheHits: 0, refreshDrift: 0, results }));
  return root;
}

describe("acquisition finalization", () => {
  it("accounts for every record, quarantines deterministic defects and reuses clean bytes without copying", async () => {
    const root = await fixture();
    const result = await finalizeAcquisition({ batchRoot: root });
    expect(result.report).toMatchObject({ counts: { requested: 4, clean: 2, doNotImport: 1, unavailable: 1, unresolvedBlocking: 0 }, acquisitionUsable: true, cleanReuse: { payloads: 2, covers: 2, copiedArtifacts: 0, acquisitionRequests: 0, networkRequests: 0 } });
    expect(result.report.records.map((record) => [record.albumId, record.classification])).toEqual([["1", "CLEAN"], ["2", "DO_NOT_IMPORT"], ["3", "CLEAN"], ["4", "SOURCE_UNAVAILABLE"]]);
    expect(JSON.parse(await readFile(result.paths.cleanInput, "utf8")).records.map((record) => record.album_id)).toEqual(["1", "3"]);
  });

  it("fails closed when clean acquisition bytes drift", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "input", "payloads", "1.json"), "drift");
    await expect(finalizeAcquisition({ batchRoot: root })).rejects.toMatchObject({ code: "CLEAN_PAYLOAD_DRIFT" });
  });
});
