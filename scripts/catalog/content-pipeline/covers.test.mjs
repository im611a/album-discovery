import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { validateAndStageCover } from "./covers.mjs";

const run = promisify(execFile);
const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-pipeline-cover-"));
  temporary.push(root);
  const incomingRoot = path.join(root, "incoming");
  await mkdir(incomingRoot);
  return { root, incomingRoot };
}

async function image(file, size = "80x120") {
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=blue:s=${size}`, "-frames:v", "1", file], { windowsHide: true });
}

describe("Content Pipeline cover profile", () => {
  it("accepts and preserves a non-square local cover without upscaling", async () => {
    const { root, incomingRoot } = await workspace();
    await image(path.join(incomingRoot, "9001.png"));
    const result = await validateAndStageCover({ albumId: "9001", incomingRoot, outputRoot: path.join(root, "out") });
    expect(result.findings).toEqual([]);
    expect(result.assets.source).toMatchObject({ codec: "png", width: 80, height: 120 });
    expect(result.assets.thumbnail.width).toBeLessThanOrEqual(80);
    expect(result.assets.thumbnail.height).toBeLessThanOrEqual(120);
    expect(result.assets.detail.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic derivatives", async () => {
    const { root, incomingRoot } = await workspace();
    await image(path.join(incomingRoot, "9001.jpg"));
    const first = await validateAndStageCover({ albumId: "9001", incomingRoot, outputRoot: path.join(root, "one") });
    const second = await validateAndStageCover({ albumId: "9001", incomingRoot, outputRoot: path.join(root, "two") });
    expect(first.assets.thumbnail.sha256).toBe(second.assets.thumbnail.sha256);
    expect(first.assets.detail.sha256).toBe(second.assets.detail.sha256);
  });

  it("reports missing, corrupt and colliding cover sources", async () => {
    const { root, incomingRoot } = await workspace();
    expect((await validateAndStageCover({ albumId: "1", incomingRoot, outputRoot: path.join(root, "out") })).findings[0].code).toBe("MISSING_COVER");
    await writeFile(path.join(incomingRoot, "2.jpg"), "not an image", "utf8");
    expect((await validateAndStageCover({ albumId: "2", incomingRoot, outputRoot: path.join(root, "out") })).findings[0].code).toBe("CORRUPT_COVER");
    await image(path.join(incomingRoot, "3.jpg"));
    await image(path.join(incomingRoot, "3.png"));
    expect((await validateAndStageCover({ albumId: "3", incomingRoot, outputRoot: path.join(root, "out") })).findings[0].code).toBe("COVER_SOURCE_COLLISION");
  });
});
