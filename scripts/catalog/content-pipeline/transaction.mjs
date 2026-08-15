import { cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint, sha256File, stableJson } from "./utils.mjs";

async function exists(target) {
  try {
    return await stat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function hashTarget(target) {
  const info = await exists(target);
  if (!info) return { exists: false, type: null, fingerprint: null };
  if (info.isFile()) return { exists: true, type: "file", bytes: info.size, fingerprint: await sha256File(target) };
  const { readdir } = await import("node:fs/promises");
  const entries = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else entries.push({ path: path.relative(target, file).replaceAll("\\", "/"), sha256: await sha256File(file), bytes: (await stat(file)).size });
    }
  }
  await visit(target);
  return { exists: true, type: "directory", files: entries.length, fingerprint: fingerprint(entries) };
}

export async function prepareTransaction({ batchId, baselineCatalogFingerprint, candidateFingerprint, batchRoot, transactionRoot, operations, allowedDestinationRoots }) {
  if (!/^CONTENT-BATCH-\d{8}-\d{3}$/.test(batchId)) throw new Error("Invalid transaction batch ID.");
  if (!/^[0-9a-f]{64}$/.test(baselineCatalogFingerprint) || !/^[0-9a-f]{64}$/.test(candidateFingerprint)) throw new Error("Transaction requires baseline and candidate SHA-256 fingerprints.");
  if (!inside(batchRoot, transactionRoot)) throw new Error("Transaction journal must remain inside the batch workspace.");
  const destinations = new Set();
  const prepared = [];
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    const staged = path.resolve(operation.staged);
    const destination = path.resolve(operation.destination);
    if (!inside(batchRoot, staged)) throw new Error(`Staged path is outside the batch workspace: ${staged}`);
    if (!allowedDestinationRoots.some((root) => inside(root, destination))) throw new Error(`Destination is outside allowed roots: ${destination}`);
    if (destinations.has(destination)) throw new Error(`Duplicate transaction destination: ${destination}`);
    destinations.add(destination);
    if (!(await exists(staged))) throw new Error(`Staged transaction source is missing: ${staged}`);
    prepared.push({
      index,
      staged,
      destination,
      backup: path.join(transactionRoot, "backup", String(index)),
      before: await hashTarget(destination),
      proposedAfter: await hashTarget(staged),
      state: "PREPARED",
    });
  }
  const manifest = { schema: "content-pipeline-v1/transaction/v1", batchId, baselineCatalogFingerprint, candidateFingerprint, state: "PREPARED", touchedProductionPaths: prepared.map((operation) => operation.destination), operations: prepared };
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(path.join(transactionRoot, "journal.json"), stableJson(manifest), "utf8");
  return manifest;
}

export async function promoteTransaction({ manifest, transactionRoot, verify = async () => true, faultAfterOperation = null }) {
  const journalPath = path.join(transactionRoot, "journal.json");
  const promoted = [];
  try {
    for (const operation of manifest.operations) {
      await mkdir(path.dirname(operation.destination), { recursive: true });
      if (operation.before.exists) {
        await mkdir(path.dirname(operation.backup), { recursive: true });
        await rename(operation.destination, operation.backup);
      }
      await rename(operation.staged, operation.destination);
      operation.state = "PROMOTED";
      promoted.push(operation);
      manifest.state = "PROMOTING";
      await writeFile(journalPath, stableJson(manifest), "utf8");
      if (faultAfterOperation === operation.index) throw new Error(`Injected transaction failure after operation ${operation.index}.`);
    }
    const verified = await verify(manifest);
    if (!verified) throw new Error("Post-promotion verification failed.");
    for (const operation of manifest.operations) {
      const actual = await hashTarget(operation.destination);
      if (actual.fingerprint !== operation.proposedAfter.fingerprint) throw new Error(`Promoted hash mismatch: ${operation.destination}`);
    }
    manifest.state = "COMMITTED";
    await writeFile(journalPath, stableJson(manifest), "utf8");
    await rm(path.join(transactionRoot, "backup"), { recursive: true, force: true });
    return manifest;
  } catch (error) {
    for (const operation of [...promoted].reverse()) {
      await rm(operation.destination, { recursive: true, force: true });
      if (operation.before.exists) await rename(operation.backup, operation.destination);
      operation.state = "ROLLED_BACK";
    }
    for (const operation of manifest.operations.filter((item) => !promoted.includes(item))) {
      if (operation.before.exists && await exists(operation.backup) && !(await exists(operation.destination))) await rename(operation.backup, operation.destination);
    }
    manifest.state = "ROLLED_BACK";
    manifest.failure = { message: String(error.message) };
    await writeFile(journalPath, stableJson(manifest), "utf8");
    throw error;
  }
}

export async function copyStagedFixture(source, destination) {
  await cp(source, destination, { recursive: true, force: true });
}
