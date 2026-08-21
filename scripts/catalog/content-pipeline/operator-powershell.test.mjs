import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function available(program) {
  try { await run(program, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], { windowsHide: true }); return true; } catch { return false; }
}

describe("PowerShell thin wrapper", () => {
  for (const program of ["powershell", "pwsh"]) it(`${program} forwards Unicode/special paths, JSON and exit codes outside the repository cwd`, async ({ skip }) => {
    if (!(await available(program))) skip();
    const root = await mkdtemp(path.join(os.tmpdir(), "operator-ps-")); temporary.push(root);
    const outside = path.join(root, "outside cwd");
    const inputRoot = path.join(root, "输入 & () []");
    await Promise.all([mkdir(outside, { recursive: true }), mkdir(inputRoot, { recursive: true })]);
    const input = path.join(inputRoot, "专辑 & sample.csv");
    await writeFile(input, "album_id,expected_title,expected_artists,core_genres\n", "utf8");
    const script = path.resolve("album-import.ps1");
    const arguments_ = program === "powershell" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "acquire", "-Input", input, "-Json"] : ["-NoProfile", "-File", script, "acquire", "-Input", input, "-Json"];
    const result = await run(program, arguments_, { cwd: outside, windowsHide: true, env: { ...process.env, NODE_ENV: "test", CONTENT_PIPELINE_OPERATOR_TEST_ROOT: root } });
    expect(JSON.parse(result.stdout)).toMatchObject({ command: "acquire", status: "ACQUISITION_COMPLETE", counts: { requested: 0 } });
    expect(result.stderr).toBe("");
  }, 30_000);
});
