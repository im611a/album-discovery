import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireLock } from "./operator-locks.mjs";
import { stableJson } from "./utils.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("operator writer locks", () => {
  it("refuses a live owner and releases only its own lock", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-lock-")); temporary.push(root);
    const file = path.join(root, "writer.lock");
    const lock = await acquireLock(file, { command: "dry-run", batchId: "CONTENT-BATCH-20260821-001" });
    await expect(acquireLock(file, { command: "prepare" })).rejects.toMatchObject({ code: "LOCK_ACTIVE" });
    await lock.release();
    await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not let stale cleanup bypass a non-terminal journal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-stale-lock-")); temporary.push(root);
    const file = path.join(root, "writer.lock");
    await writeFile(file, stableJson({ pid: 2_147_483_647, startedAt: "2026-01-01T00:00:00.000Z" }));
    await expect(acquireLock(file, { command: "promote", transactionState: async () => "PROMOTING" })).rejects.toMatchObject({ code: "RECOVERY_REQUIRED" });
  });
});
