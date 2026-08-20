import { open, cp, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fingerprint, sha256File, stableJson } from "./utils.mjs";

const JOURNAL_SCHEMA = "content-pipeline-v1/transaction/v2";

async function exists(target) {
  try { return await stat(target); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function sameVolume(left, right) {
  return path.parse(path.resolve(left)).root.toLocaleLowerCase("en-US") === path.parse(path.resolve(right)).root.toLocaleLowerCase("en-US");
}

function ambiguous(message) {
  const error = new Error(`TRANSACTION_RECOVERY_STATE_AMBIGUOUS: ${message}`);
  error.code = "TRANSACTION_RECOVERY_STATE_AMBIGUOUS";
  return error;
}

async function hashTarget(target) {
  const info = await exists(target);
  if (!info) return { exists: false, type: null, fingerprint: null };
  if (info.isFile()) return { exists: true, type: "file", bytes: info.size, fingerprint: await sha256File(target) };
  if (!info.isDirectory()) throw ambiguous(`Unsupported filesystem target: ${target}`);
  const { readdir } = await import("node:fs/promises");
  const entries = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) entries.push({ path: path.relative(target, file).replaceAll("\\", "/"), sha256: await sha256File(file), bytes: (await stat(file)).size });
      else throw ambiguous(`Unsupported filesystem entry: ${file}`);
    }
  }
  await visit(target);
  return { exists: true, type: "directory", files: entries.length, fingerprint: fingerprint(entries) };
}

function sameSnapshot(actual, expected) {
  return actual.exists === expected.exists && actual.type === expected.type && actual.fingerprint === expected.fingerprint;
}

async function invokeFault(faultInjector, point, context = {}) {
  if (faultInjector) await faultInjector(point, context);
}

async function atomicWriteJournal(transactionRoot, manifest, faultInjector = null, label = manifest.state) {
  const journalPath = path.join(transactionRoot, "journal.json");
  const temporary = path.join(transactionRoot, `.journal-${process.pid}-${Date.now()}.tmp`);
  await mkdir(transactionRoot, { recursive: true });
  const handle = await open(temporary, "wx");
  try { await handle.writeFile(stableJson(manifest), "utf8"); await handle.sync(); } finally { await handle.close(); }
  try {
    await invokeFault(faultInjector, `journal:${label}`, { manifest });
    await rename(temporary, journalPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function readJournal(transactionRoot) {
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(transactionRoot, "journal.json"), "utf8")); }
  catch (error) { throw ambiguous(`Journal is missing or malformed: ${error.message}`); }
  if (manifest.schema !== JOURNAL_SCHEMA || !Array.isArray(manifest.operations)) throw ambiguous("Unsupported journal schema or operation list.");
  return manifest;
}

function validateIdentity(manifest, { expectedBatchId, expectedCandidateFingerprint, expectedResultFingerprint, allowedDestinationRoots = null } = {}) {
  if (!/^CONTENT-BATCH-\d{8}-\d{3}$/.test(manifest.batchId)) throw ambiguous("Invalid journal batch identity.");
  if (expectedBatchId && manifest.batchId !== expectedBatchId) throw ambiguous("Foreign transaction batch identity.");
  if (expectedCandidateFingerprint && manifest.candidateFingerprint !== expectedCandidateFingerprint) throw ambiguous("Candidate fingerprint does not match the authorized transaction.");
  if (expectedResultFingerprint && manifest.resultFingerprint !== expectedResultFingerprint) throw ambiguous("Result fingerprint does not match the authorized transaction.");
  const roots = allowedDestinationRoots ?? manifest.allowedDestinationRoots;
  if (!Array.isArray(roots) || !roots.length) throw ambiguous("Journal has no allowed destination roots.");
  for (const operation of manifest.operations) {
    if (!roots.some((root) => inside(root, operation.destination))) throw ambiguous(`Destination escaped the authorized roots: ${operation.destination}`);
  }
}

async function validateCandidate(manifest) {
  for (const operation of manifest.operations) {
    const [staged, shadow] = await Promise.all([hashTarget(operation.staged), hashTarget(operation.shadow)]);
    if (!sameSnapshot(staged, operation.proposedAfter)) throw ambiguous(`Qualified staged candidate drift: ${operation.staged}`);
    if (!sameSnapshot(shadow, operation.proposedAfter)) throw ambiguous(`Transaction shadow drift: ${operation.shadow}`);
  }
}

async function verifyDestinations(manifest, field) {
  for (const operation of manifest.operations) if (!sameSnapshot(await hashTarget(operation.destination), operation[field])) return false;
  return true;
}

async function rollbackToBefore(manifest, transactionRoot, { recoveredAfterInterruption = false, faultInjector = null } = {}) {
  manifest.state = "RECOVERING";
  await atomicWriteJournal(transactionRoot, manifest, null, "RECOVERING");
  for (const operation of [...manifest.operations].reverse()) {
    await invokeFault(faultInjector, `rollback-before:${operation.index}`, { operation, manifest });
    const [destination, backup] = await Promise.all([hashTarget(operation.destination), hashTarget(operation.backup)]);
    if (operation.before.exists) {
      if (sameSnapshot(backup, operation.before)) {
        if (destination.exists && !sameSnapshot(destination, operation.proposedAfter)) throw ambiguous(`Unexpected destination blocks rollback: ${operation.destination}`);
        if (destination.exists) await rm(operation.destination, { recursive: true, force: true });
        await mkdir(path.dirname(operation.destination), { recursive: true });
        await rename(operation.backup, operation.destination);
      } else if (!backup.exists && sameSnapshot(destination, operation.before)) {
        // Never mutated, or already restored by an earlier recovery attempt.
      } else throw ambiguous(`Before-state backup cannot explain destination: ${operation.destination}`);
    } else {
      if (backup.exists) throw ambiguous(`Unexpected backup for absent destination: ${operation.backup}`);
      if (destination.exists && !sameSnapshot(destination, operation.proposedAfter)) throw ambiguous(`Unexpected new destination content: ${operation.destination}`);
      if (destination.exists) await rm(operation.destination, { recursive: true, force: true });
    }
    operation.phase = "ROLLED_BACK";
    await atomicWriteJournal(transactionRoot, manifest, null, `ROLLED_BACK:${operation.index}`);
    await invokeFault(faultInjector, `rollback-after:${operation.index}`, { operation, manifest });
  }
  if (!(await verifyDestinations(manifest, "before"))) throw ambiguous("Production did not return to BEFORE.");
  await validateCandidate(manifest);
  manifest.state = "ROLLED_BACK";
  manifest.recoveredAfterInterruption = recoveredAfterInterruption || manifest.recoveredAfterInterruption === true;
  await atomicWriteJournal(transactionRoot, manifest, null, "ROLLED_BACK");
  return manifest;
}

export async function prepareTransaction({ batchId, baselineCatalogFingerprint, candidateFingerprint, resultFingerprint, batchRoot, transactionRoot, operations, allowedDestinationRoots }) {
  if (!/^CONTENT-BATCH-\d{8}-\d{3}$/.test(batchId)) throw new Error("Invalid transaction batch ID.");
  if (![baselineCatalogFingerprint, candidateFingerprint, resultFingerprint].every((value) => /^[0-9a-f]{64}$/.test(value))) throw new Error("Transaction requires baseline, candidate, and result SHA-256 fingerprints.");
  if (!inside(batchRoot, transactionRoot)) throw new Error("Transaction journal must remain inside the batch workspace.");
  if (!operations.length) throw new Error("Transaction requires at least one operation.");
  if (await exists(path.join(transactionRoot, "journal.json"))) throw new Error("Transaction journal already exists; inspect or recover it first.");
  const destinations = new Set();
  const prepared = [];
  for (let index = 0; index < operations.length; index += 1) {
    const staged = path.resolve(operations[index].staged);
    const destination = path.resolve(operations[index].destination);
    const backup = path.join(transactionRoot, "backup", String(index));
    const shadow = path.join(transactionRoot, "shadow", String(index));
    const ready = path.join(transactionRoot, "ready", String(index));
    if (!inside(batchRoot, staged)) throw new Error(`Staged path is outside the batch workspace: ${staged}`);
    if (!allowedDestinationRoots.some((root) => inside(root, destination))) throw new Error(`Destination is outside allowed roots: ${destination}`);
    if (!sameVolume(transactionRoot, destination)) throw new Error(`CROSS_FILESYSTEM_ATOMIC_RENAME_UNAVAILABLE: ${destination}`);
    if (destinations.has(destination)) throw new Error(`Duplicate transaction destination: ${destination}`);
    destinations.add(destination);
    if (!(await exists(staged))) throw new Error(`Staged transaction source is missing: ${staged}`);
    for (const internal of [backup, shadow, ready]) if (await exists(internal)) throw new Error(`Transaction internal path collision: ${internal}`);
    const proposedAfter = await hashTarget(staged);
    await mkdir(path.dirname(shadow), { recursive: true });
    await cp(staged, shadow, { recursive: true, force: false, errorOnExist: true });
    await mkdir(path.dirname(ready), { recursive: true });
    await cp(shadow, ready, { recursive: true, force: false, errorOnExist: true });
    if (!sameSnapshot(await hashTarget(shadow), proposedAfter) || !sameSnapshot(await hashTarget(ready), proposedAfter)) throw new Error(`Transaction staging verification failed: ${staged}`);
    prepared.push({ index, staged, shadow, ready, destination, backup, before: await hashTarget(destination), proposedAfter, phase: "PREPARED" });
  }
  const productionBeforeFingerprint = fingerprint(prepared.map(({ destination, before }) => ({ destination, before })));
  const intendedAfterFingerprint = fingerprint(prepared.map(({ destination, proposedAfter }) => ({ destination, proposedAfter })));
  const resolvedAllowedDestinationRoots = allowedDestinationRoots.map((root) => path.resolve(root));
  const transactionId = fingerprint({ batchId, candidateFingerprint, resultFingerprint, productionBeforeFingerprint, intendedAfterFingerprint, destinations: prepared.map((item) => item.destination) });
  const manifest = { schema: JOURNAL_SCHEMA, transactionId, batchId, baselineCatalogFingerprint, candidateFingerprint, resultFingerprint, productionBeforeFingerprint, intendedAfterFingerprint, allowedDestinationRoots: resolvedAllowedDestinationRoots, state: "PREPARED", commitSemantics: "OFFLINE_SINGLE_WRITER_JOURNALED_REVERSIBLE_MULTI_PATH", touchedProductionPaths: prepared.map((operation) => operation.destination), operations: prepared };
  await atomicWriteJournal(transactionRoot, manifest);
  return manifest;
}

export async function promoteTransaction({ manifest: suppliedManifest = null, transactionRoot, verify = async () => true, faultAfterOperation = null, faultInjector = null, rollbackFaultInjector = null }) {
  const manifest = await readJournal(transactionRoot);
  if (suppliedManifest?.transactionId && suppliedManifest.transactionId !== manifest.transactionId) throw ambiguous("Supplied manifest is not the durable journal authority.");
  validateIdentity(manifest);
  if (manifest.state !== "PREPARED") throw ambiguous(`Promotion requires PREPARED state, found ${manifest.state}.`);
  await validateCandidate(manifest);
  for (const operation of manifest.operations) {
    if (!sameSnapshot(await hashTarget(operation.destination), operation.before)) {
      manifest.state = "ABORTED";
      manifest.failure = { code: "DESTINATION_CHANGED_SINCE_PREPARE", message: operation.destination };
      await atomicWriteJournal(transactionRoot, manifest, null, "ABORTED");
      const error = new Error(`DESTINATION_CHANGED_SINCE_PREPARE: ${operation.destination}`);
      error.code = "DESTINATION_CHANGED_SINCE_PREPARE";
      throw error;
    }
  }
  try {
    await invokeFault(faultInjector, "before-first-mutation", { manifest });
    manifest.state = "PROMOTING";
    await atomicWriteJournal(transactionRoot, manifest, faultInjector, "PROMOTING");
  } catch (error) {
    manifest.state = "ABORTED";
    manifest.failure = { code: error.code ?? "PRE_MUTATION_ABORT", message: String(error.message) };
    await atomicWriteJournal(transactionRoot, manifest, null, "ABORTED");
    throw error;
  }
  try {
    for (const operation of manifest.operations) {
      operation.phase = "BACKUP_PENDING";
      await atomicWriteJournal(transactionRoot, manifest, faultInjector, `BACKUP_PENDING:${operation.index}`);
      await invokeFault(faultInjector, `before-backup:${operation.index}`, { operation, manifest });
      if (operation.before.exists) { await mkdir(path.dirname(operation.backup), { recursive: true }); await rename(operation.destination, operation.backup); }
      operation.phase = "BACKED_UP";
      await atomicWriteJournal(transactionRoot, manifest, faultInjector, `BACKED_UP:${operation.index}`);
      await invokeFault(faultInjector, `after-backup:${operation.index}`, { operation, manifest });
      operation.phase = "INSTALL_PENDING";
      await atomicWriteJournal(transactionRoot, manifest, faultInjector, `INSTALL_PENDING:${operation.index}`);
      await mkdir(path.dirname(operation.destination), { recursive: true });
      await rename(operation.ready, operation.destination);
      operation.phase = "INSTALLED";
      await atomicWriteJournal(transactionRoot, manifest, faultInjector, `INSTALLED:${operation.index}`);
      await invokeFault(faultInjector, `after-install:${operation.index}`, { operation, manifest });
      if (faultAfterOperation === operation.index) throw new Error(`Injected transaction failure after operation ${operation.index}.`);
    }
    await invokeFault(faultInjector, "after-all-writes", { manifest });
    if (!(await verify(manifest))) throw new Error("Post-promotion verification failed.");
    if (!(await verifyDestinations(manifest, "proposedAfter"))) throw new Error("Promoted destination fingerprint mismatch.");
    await validateCandidate(manifest);
    await invokeFault(faultInjector, "before-commit-journal", { manifest });
    manifest.state = "COMMITTED";
    await atomicWriteJournal(transactionRoot, manifest, faultInjector, "COMMITTED");
    await rm(path.join(transactionRoot, "backup"), { recursive: true, force: true });
    await rm(path.join(transactionRoot, "ready"), { recursive: true, force: true });
    return manifest;
  } catch (error) {
    manifest.failure = { code: error.code ?? "PROMOTION_FAILED", message: String(error.message) };
    try { await rollbackToBefore(manifest, transactionRoot, { faultInjector: rollbackFaultInjector }); }
    catch (rollbackError) {
      manifest.state = "RECOVERY_REQUIRED";
      manifest.rollbackFailure = { code: rollbackError.code ?? "ROLLBACK_FAILED", message: String(rollbackError.message) };
      await atomicWriteJournal(transactionRoot, manifest, null, "RECOVERY_REQUIRED");
      throw rollbackError;
    }
    throw error;
  }
}

export async function recoverTransaction({ transactionRoot, expectedBatchId, expectedCandidateFingerprint, expectedResultFingerprint, allowedDestinationRoots = null }) {
  const manifest = await readJournal(transactionRoot);
  validateIdentity(manifest, { expectedBatchId, expectedCandidateFingerprint, expectedResultFingerprint, allowedDestinationRoots });
  await validateCandidate(manifest);
  if (manifest.state === "COMMITTED") {
    if (!(await verifyDestinations(manifest, "proposedAfter"))) throw ambiguous("Committed transaction destination drift.");
    return { manifest, action: "NO_OP_COMMITTED" };
  }
  if (manifest.state === "ROLLED_BACK" || manifest.state === "ABORTED") {
    if (!(await verifyDestinations(manifest, "before"))) throw ambiguous(`Terminal ${manifest.state} transaction destination drift.`);
    return { manifest, action: `NO_OP_${manifest.state}` };
  }
  return { manifest: await rollbackToBefore(manifest, transactionRoot, { recoveredAfterInterruption: true }), action: "ROLLED_BACK_TO_BEFORE" };
}

export async function inspectTransaction(transactionRoot) { return readJournal(transactionRoot); }
export async function copyStagedFixture(source, destination) { await cp(source, destination, { recursive: true, force: true }); }
