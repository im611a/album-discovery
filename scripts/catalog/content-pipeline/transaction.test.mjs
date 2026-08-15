import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareTransaction, promoteTransaction } from "./transaction.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-pipeline-transaction-"));
  temporary.push(root);
  const batchRoot = path.join(root, "batch");
  const destinationRoot = path.join(root, "production-fixture");
  const staged = path.join(batchRoot, "candidate", "file.txt");
  const destination = path.join(destinationRoot, "file.txt");
  const transactionRoot = path.join(batchRoot, "transaction");
  await Promise.all([mkdir(path.dirname(staged), { recursive: true }), mkdir(path.dirname(destination), { recursive: true })]);
  await writeFile(staged, "after", "utf8");
  await writeFile(destination, "before", "utf8");
  return { batchRoot, destinationRoot, staged, destination, transactionRoot };
}

describe("Content Pipeline transaction foundation", () => {
  it("promotes a verified staged target", async () => {
    const value = await fixture();
    const manifest = await prepareTransaction({ batchId: "CONTENT-BATCH-20260815-001", baselineCatalogFingerprint: "a".repeat(64), candidateFingerprint: "b".repeat(64), batchRoot: value.batchRoot, transactionRoot: value.transactionRoot, operations: [{ staged: value.staged, destination: value.destination }], allowedDestinationRoots: [value.destinationRoot] });
    const result = await promoteTransaction({ manifest, transactionRoot: value.transactionRoot });
    expect(result.state).toBe("COMMITTED");
    expect(await readFile(value.destination, "utf8")).toBe("after");
  });

  it("rolls back the original target after an injected promotion failure", async () => {
    const value = await fixture();
    const manifest = await prepareTransaction({ batchId: "CONTENT-BATCH-20260815-001", baselineCatalogFingerprint: "a".repeat(64), candidateFingerprint: "b".repeat(64), batchRoot: value.batchRoot, transactionRoot: value.transactionRoot, operations: [{ staged: value.staged, destination: value.destination }], allowedDestinationRoots: [value.destinationRoot] });
    await expect(promoteTransaction({ manifest, transactionRoot: value.transactionRoot, faultAfterOperation: 0 })).rejects.toThrow("Injected transaction failure");
    expect(await readFile(value.destination, "utf8")).toBe("before");
    const journal = JSON.parse(await readFile(path.join(value.transactionRoot, "journal.json"), "utf8"));
    expect(journal.state).toBe("ROLLED_BACK");
  });

  it("rejects destinations outside explicitly allowed roots", async () => {
    const value = await fixture();
    await expect(prepareTransaction({ batchId: "CONTENT-BATCH-20260815-001", baselineCatalogFingerprint: "a".repeat(64), candidateFingerprint: "b".repeat(64), batchRoot: value.batchRoot, transactionRoot: value.transactionRoot, operations: [{ staged: value.staged, destination: value.destination }], allowedDestinationRoots: [path.join(value.batchRoot, "not-production")] })).rejects.toThrow("outside allowed roots");
  });
});
