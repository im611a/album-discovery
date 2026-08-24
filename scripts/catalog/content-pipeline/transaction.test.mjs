import { fork } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectTransaction, prepareTransaction, promoteTransaction, recoverTransaction } from "./transaction.mjs";
import { sha256File } from "./utils.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixture(operationCount = 4) {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-pipeline-transaction-"));
  temporary.push(root);
  const batchRoot = path.join(root, "batch");
  const destinationRoot = path.join(root, "production-fixture");
  const transactionRoot = path.join(batchRoot, "transaction");
  const operations = [];
  for (let index = 0; index < operationCount; index += 1) {
    const staged = path.join(batchRoot, "candidate", `${index}.txt`);
    const destination = path.join(destinationRoot, `${index}.txt`);
    await Promise.all([mkdir(path.dirname(staged), { recursive: true }), mkdir(path.dirname(destination), { recursive: true })]);
    await writeFile(staged, `after-${index}`, "utf8");
    await writeFile(destination, `before-${index}`, "utf8");
    operations.push({ staged, destination });
  }
  return { batchRoot, destinationRoot, transactionRoot, operations, candidateFingerprint: "b".repeat(64) };
}

async function actualWriteSetFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-pipeline-actual-write-set-"));
  temporary.push(root);
  const batchRoot = path.join(root, "batch");
  const destinationRoot = path.join(root, "production-fixture");
  const transactionRoot = path.join(batchRoot, "transaction");
  const stagedCatalog = path.join(batchRoot, "candidate", "generated");
  const productionCatalog = path.join(destinationRoot, "generated");
  await Promise.all([mkdir(stagedCatalog, { recursive: true }), mkdir(productionCatalog, { recursive: true })]);
  await writeFile(path.join(stagedCatalog, "catalog.json"), "candidate-catalog", "utf8");
  await writeFile(path.join(productionCatalog, "catalog.json"), "production-catalog", "utf8");
  const operations = [{ staged: stagedCatalog, destination: productionCatalog }];
  for (let index = 1; index < 25; index += 1) {
    const staged = path.join(batchRoot, "candidate", "covers", `${index}.webp`);
    const destination = path.join(destinationRoot, "covers", `${index}.webp`);
    await mkdir(path.dirname(staged), { recursive: true });
    await writeFile(staged, `cover-${index}`, "utf8");
    operations.push({ staged, destination });
  }
  return { batchRoot, destinationRoot, transactionRoot, operations, candidateFingerprint: "d".repeat(64) };
}

async function assertActualWriteSetBeforeAndCandidate(value) {
  expect(await readFile(path.join(value.operations[0].destination, "catalog.json"), "utf8")).toBe("production-catalog");
  expect(await readFile(path.join(value.operations[0].staged, "catalog.json"), "utf8")).toBe("candidate-catalog");
  for (let index = 1; index < value.operations.length; index += 1) {
    await expect(readFile(value.operations[index].destination, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(value.operations[index].staged, "utf8")).toBe(`cover-${index}`);
  }
}

async function prepare(value) {
  return prepareTransaction({ batchId: "CONTENT-BATCH-20260815-001", baselineCatalogFingerprint: "a".repeat(64), candidateFingerprint: value.candidateFingerprint, resultFingerprint: "e".repeat(64), batchRoot: value.batchRoot, transactionRoot: value.transactionRoot, operations: value.operations, allowedDestinationRoots: [value.destinationRoot] });
}

async function snapshot(value, prefix) {
  return Promise.all(value.operations.map(({ staged, destination }) => sha256File(prefix === "candidate" ? staged : destination)));
}

async function assertBeforeAndCandidate(value, candidateBefore) {
  expect(await Promise.all(value.operations.map(({ destination }) => readFile(destination, "utf8")))).toEqual(value.operations.map((_, index) => `before-${index}`));
  expect(await snapshot(value, "candidate")).toEqual(candidateBefore);
}

const injected = (target) => async (point) => { if (point === target) throw new Error(`INJECTED:${point}`); };

describe("Content Pipeline crash-consistent transaction", () => {
  it("promotes all paths, preserves candidate, and treats committed recovery as an idempotent no-op", async () => {
    const value = await fixture();
    const candidateBefore = await snapshot(value, "candidate");
    await prepare(value);
    const result = await promoteTransaction({ transactionRoot: value.transactionRoot });
    expect(result.state).toBe("COMMITTED");
    expect(await Promise.all(value.operations.map(({ destination }) => readFile(destination, "utf8")))).toEqual(value.operations.map((_, index) => `after-${index}`));
    expect(await snapshot(value, "candidate")).toEqual(candidateBefore);
    expect((await recoverTransaction({ transactionRoot: value.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260815-001", expectedCandidateFingerprint: value.candidateFingerprint })).action).toBe("NO_OP_COMMITTED");
  });

  it("fails closed on destination drift before the first production write", async () => {
    const value = await fixture();
    const candidateBefore = await snapshot(value, "candidate");
    await prepare(value);
    await writeFile(value.operations[1].destination, "external-change", "utf8");
    await expect(promoteTransaction({ transactionRoot: value.transactionRoot })).rejects.toThrow("DESTINATION_CHANGED_SINCE_PREPARE");
    expect(await readFile(value.operations[0].destination, "utf8")).toBe("before-0");
    expect(await readFile(value.operations[1].destination, "utf8")).toBe("external-change");
    expect((await inspectTransaction(value.transactionRoot)).state).toBe("ABORTED");
    expect(await snapshot(value, "candidate")).toEqual(candidateBefore);
  });

  it("rolls back every meaningful caught mutation boundary and preserves the candidate", async () => {
    const points = ["before-first-mutation", "after-all-writes", "before-commit-journal"];
    for (let index = 0; index < 4; index += 1) points.push(`after-backup:${index}`, `after-install:${index}`);
    for (const point of points) {
      const value = await fixture();
      const candidateBefore = await snapshot(value, "candidate");
      await prepare(value);
      await expect(promoteTransaction({ transactionRoot: value.transactionRoot, faultInjector: injected(point) })).rejects.toThrow("INJECTED");
      await assertBeforeAndCandidate(value, candidateBefore);
      const journal = await inspectTransaction(value.transactionRoot);
      expect(["ABORTED", "ROLLED_BACK"]).toContain(journal.state);
      const recovery = await recoverTransaction({ transactionRoot: value.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260815-001", expectedCandidateFingerprint: value.candidateFingerprint });
      expect(["NO_OP_ABORTED", "NO_OP_ROLLED_BACK"]).toContain(recovery.action);
    }
  }, 30_000);

  it("covers the real 25-operation equivalence classes: existing catalog directory plus absent early, middle, and final cover destinations", async () => {
    const boundaryIndexes = [0, 1, 12, 24];
    for (const phase of ["after-backup", "after-install"]) for (const index of boundaryIndexes) {
      const value = await actualWriteSetFixture();
      await prepare(value);
      await expect(promoteTransaction({ transactionRoot: value.transactionRoot, faultInjector: injected(`${phase}:${index}`) })).rejects.toThrow("INJECTED");
      await assertActualWriteSetBeforeAndCandidate(value);
      expect((await inspectTransaction(value.transactionRoot)).state).toBe("ROLLED_BACK");
    }
  }, 120_000);

  it("recovers after a journal update failure and after an interrupted rollback", async () => {
    for (const scenario of ["journal:INSTALLED:1", "rollback"]) {
      const value = await fixture();
      const candidateBefore = await snapshot(value, "candidate");
      await prepare(value);
      if (scenario === "rollback") {
        await expect(promoteTransaction({ transactionRoot: value.transactionRoot, faultInjector: injected("after-install:2"), rollbackFaultInjector: injected("rollback-before:1") })).rejects.toThrow();
        expect((await inspectTransaction(value.transactionRoot)).state).toBe("RECOVERY_REQUIRED");
      } else await expect(promoteTransaction({ transactionRoot: value.transactionRoot, faultInjector: injected(scenario) })).rejects.toThrow("INJECTED");
      const recovered = await recoverTransaction({ transactionRoot: value.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260815-001", expectedCandidateFingerprint: value.candidateFingerprint });
      expect(["ROLLED_BACK_TO_BEFORE", "NO_OP_ROLLED_BACK"]).toContain(recovered.action);
      await assertBeforeAndCandidate(value, candidateBefore);
      expect((await recoverTransaction({ transactionRoot: value.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260815-001", expectedCandidateFingerprint: value.candidateFingerprint })).action).toBe("NO_OP_ROLLED_BACK");
    }
  });

  it("recovers deterministically after the parent forcibly terminates a child process", async () => {
    const value = await fixture();
    const candidateBefore = await snapshot(value, "candidate");
    await prepare(value);
    const child = fork(path.resolve("scripts/catalog/content-pipeline/transaction-interruption-child.mjs"), [], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
    const exited = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
      child.on("message", (message) => {
        if (message.type !== "INTERRUPTION_BOUNDARY_REACHED") return reject(new Error(JSON.stringify(message)));
        child.kill();
      });
    });
    child.send({ transactionRoot: value.transactionRoot, interruptionPoint: "after-install:1" });
    await exited;
    expect((await inspectTransaction(value.transactionRoot)).state).toBe("PROMOTING");
    expect((await recoverTransaction({ transactionRoot: value.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260815-001", expectedCandidateFingerprint: value.candidateFingerprint })).action).toBe("ROLLED_BACK_TO_BEFORE");
    await assertBeforeAndCandidate(value, candidateBefore);
    expect((await recoverTransaction({ transactionRoot: value.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260815-001", expectedCandidateFingerprint: value.candidateFingerprint })).action).toBe("NO_OP_ROLLED_BACK");
  });

  it("fails closed for malformed, foreign, candidate-drift, missing-backup, and unexpected destination states", async () => {
    const malformed = await fixture(1);
    await mkdir(malformed.transactionRoot, { recursive: true });
    await writeFile(path.join(malformed.transactionRoot, "journal.json"), "{", "utf8");
    await expect(recoverTransaction({ transactionRoot: malformed.transactionRoot })).rejects.toThrow("TRANSACTION_RECOVERY_STATE_AMBIGUOUS");

    const foreign = await fixture(1); await prepare(foreign);
    await expect(recoverTransaction({ transactionRoot: foreign.transactionRoot, expectedBatchId: "CONTENT-BATCH-20260816-001" })).rejects.toThrow("Foreign transaction");
    await expect(recoverTransaction({ transactionRoot: foreign.transactionRoot, expectedCandidateFingerprint: "c".repeat(64) })).rejects.toThrow("Candidate fingerprint");
    await writeFile(foreign.operations[0].staged, "candidate-drift", "utf8");
    await expect(recoverTransaction({ transactionRoot: foreign.transactionRoot, expectedCandidateFingerprint: foreign.candidateFingerprint })).rejects.toThrow("staged candidate drift");

    const missingBackup = await fixture(1); await prepare(missingBackup);
    const child = fork(path.resolve("scripts/catalog/content-pipeline/transaction-interruption-child.mjs"), [], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
    const exited = new Promise((resolve) => { child.once("exit", resolve); child.on("message", () => child.kill()); });
    child.send({ transactionRoot: missingBackup.transactionRoot, interruptionPoint: "after-install:0" }); await exited;
    await rm(path.join(missingBackup.transactionRoot, "backup", "0"), { recursive: true, force: true });
    await expect(recoverTransaction({ transactionRoot: missingBackup.transactionRoot, expectedCandidateFingerprint: missingBackup.candidateFingerprint })).rejects.toThrow("TRANSACTION_RECOVERY_STATE_AMBIGUOUS");
  });

  it("rejects destinations outside explicitly allowed roots", async () => {
    const value = await fixture(1);
    await expect(prepareTransaction({ batchId: "CONTENT-BATCH-20260815-001", baselineCatalogFingerprint: "a".repeat(64), candidateFingerprint: value.candidateFingerprint, resultFingerprint: "e".repeat(64), batchRoot: value.batchRoot, transactionRoot: value.transactionRoot, operations: value.operations, allowedDestinationRoots: [path.join(value.batchRoot, "not-production")] })).rejects.toThrow("outside allowed roots");
  });
});
