import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { stableJson } from "./utils.mjs";

function lockError(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code === "ESRCH" ? false : true; }
}

export async function acquireLock(file, { command, batchId = null, transactionState = null } = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  const owner = { schema: "content-pipeline-v1/operator-lock/v1", pid: process.pid, command, batchId, startedAt: new Date().toISOString() };
  let handle;
  try { handle = await open(file, "wx"); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let current;
    try { current = JSON.parse(await readFile(file, "utf8")); }
    catch { throw lockError("LOCK_STATE_AMBIGUOUS", `Malformed lock must be inspected manually: ${file}`); }
    const alive = processAlive(Number(current.pid));
    if (alive !== false) throw lockError("LOCK_ACTIVE", `Writer PID ${current.pid} owns ${file}`);
    const state = transactionState ? await transactionState() : null;
    if (state && !["COMMITTED", "ROLLED_BACK", "ABORTED"].includes(state)) throw lockError("RECOVERY_REQUIRED", `Dead writer left transaction state ${state}.`);
    await rm(file, { force: true });
    try { handle = await open(file, "wx"); }
    catch { throw lockError("LOCK_RACE", `Another writer acquired ${file}`); }
  }
  await handle.writeFile(stableJson(owner), "utf8");
  await handle.sync();
  await handle.close();
  return {
    file,
    owner,
    async release() {
      let current;
      try { current = JSON.parse(await readFile(file, "utf8")); } catch { return; }
      if (current.pid === owner.pid && current.startedAt === owner.startedAt) await rm(file, { force: true });
    },
  };
}

export async function withLocks(locks, action) {
  const acquired = [];
  try {
    for (const lock of locks) acquired.push(await acquireLock(lock.file, lock.options));
    return await action();
  } finally {
    for (const lock of acquired.reverse()) await lock.release();
  }
}
