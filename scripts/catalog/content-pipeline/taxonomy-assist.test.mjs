import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildTaxonomyProposal, applyTaxonomyDecisions } from "./taxonomy-assist.mjs";
import { fingerprint, stableJson } from "./utils.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "taxonomy-assist-")); temporary.push(root);
  await Promise.all([mkdir(path.join(root, "acquisition", "finalized"), { recursive: true }), mkdir(path.join(root, "input", "payloads"), { recursive: true })]);
  const cleanInput = { schema: "content-pipeline-v1/clean-acquisition-input/v1", batchId: "CONTENT-BATCH-20260822-001", sourceInputSha256: "a".repeat(64), records: [
    { album_id: "10", expected_title: "Stable", expected_artists: "Stable Artist", core_genres: "" },
    { album_id: "11", expected_title: "Ambiguous", expected_artists: "Mixed Artist", core_genres: "" },
    { album_id: "12", expected_title: "Unknown", expected_artists: "New Artist", core_genres: "" },
  ] };
  cleanInput.fingerprint = fingerprint(cleanInput);
  await writeFile(path.join(root, "acquisition", "finalized", "clean-input.json"), stableJson(cleanInput));
  const finalization = { schema: "content-pipeline-v1/acquisition-finalization/v1", batchId: cleanInput.batchId, counts: { clean: 3, unresolvedBlocking: 0 }, acquisitionUsable: true, cleanInput: { path: "acquisition/finalized/clean-input.json", fingerprint: cleanInput.fingerprint } };
  finalization.fingerprint = fingerprint(finalization);
  await writeFile(path.join(root, "acquisition", "finalized", "report.json"), stableJson(finalization));
  await writeFile(path.join(root, "batch.json"), stableJson({ id: cleanInput.batchId, input: "input/input.json", operator: {} }));
  for (const [id, artistId, name] of [["10", 1, "Stable Artist"], ["11", 2, "Mixed Artist"], ["12", 3, "New Artist"]]) await writeFile(path.join(root, "input", "payloads", `${id}.json`), stableJson({ album: { id: Number(id), name, artists: [{ id: artistId, name }] } }));
  const catalogPath = path.join(root, "catalog.json");
  await writeFile(catalogPath, stableJson({ taxonomy: [{ key: "rock", kind: "core" }, { key: "pop", kind: "core" }], albums: [
    { neteaseAlbumId: "1", title: "R1", coreGenres: ["rock"], artists: [{ neteaseArtistId: "1", name: "Stable Artist" }] },
    { neteaseAlbumId: "2", title: "P1", coreGenres: ["pop"], artists: [{ neteaseArtistId: "2", name: "Mixed Artist" }] },
    { neteaseAlbumId: "3", title: "R2", coreGenres: ["rock"], artists: [{ neteaseArtistId: "2", name: "Mixed Artist" }] },
  ] }));
  return { root, catalogPath };
}

describe("bulk taxonomy assist", () => {
  it("groups explainable proposals without auto-accepting them and applies only explicit complete decisions", async () => {
    const { root, catalogPath } = await fixture();
    const result = await buildTaxonomyProposal({ batchRoot: root, catalogPath });
    expect(result.proposal.counts).toEqual({ albums: 3, highConfidenceAlbums: 1, ambiguousAlbums: 1, noEvidenceAlbums: 1, groups: 3, highConfidenceGroups: 1, ambiguousGroups: 1, noEvidenceGroups: 1 });
    const template = JSON.parse(await readFile(result.paths.template, "utf8"));
    expect(template.decisions.every((decision) => decision.decision === "PENDING")).toBe(true);
    template.decisions = template.decisions.map((decision) => ({ ...decision, decision: "ACCEPT", coreGenres: decision.coreGenres.length ? decision.coreGenres : ["rock"] }));
    const applied = await applyTaxonomyDecisions({ batchRoot: root, catalogPath, artifact: template });
    expect(applied.decisions).toMatchObject({ unresolvedGroups: 0 });
    const input = JSON.parse(await readFile(applied.paths.activeInput, "utf8"));
    expect(input.records.every((record) => record.core_genres.length > 0)).toBe(true);
    expect(JSON.parse(await readFile(path.join(root, "batch.json"), "utf8")).operator.activeInput).toBe("taxonomy/applied-input.json");
  });

  it("keeps partial human decisions blocking and rejects unknown taxonomy keys", async () => {
    const { root, catalogPath } = await fixture();
    const result = await buildTaxonomyProposal({ batchRoot: root, catalogPath });
    const one = { schema: "content-pipeline-v1/taxonomy-decisions/v1", batchId: result.proposal.batchId, proposalFingerprint: result.proposal.fingerprint, decisions: [{ groupId: result.proposal.groups[0].groupId, decision: "ACCEPT", coreGenres: ["rock"] }] };
    expect((await applyTaxonomyDecisions({ batchRoot: root, catalogPath, artifact: one })).decisions.unresolvedGroups).toBe(2);
    await expect(applyTaxonomyDecisions({ batchRoot: root, catalogPath, artifact: { ...one, decisions: [{ ...one.decisions[0], coreGenres: ["invented"] }] } })).rejects.toMatchObject({ code: "TAXONOMY_GENRE_NOT_ALLOWED" });
  });
});
