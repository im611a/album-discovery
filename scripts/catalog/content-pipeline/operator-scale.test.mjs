import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBatchInput } from "./input.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("operator input scale envelope", () => {
  for (const count of [100, 500, 1000]) it(`streams ${count} rows through the canonical parser`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), `operator-scale-${count}-`)); temporary.push(root);
    const file = path.join(root, "input.csv");
    const rows = ["album_id,expected_title,expected_artists,core_genres"];
    for (let index = 1; index <= count; index += 1) rows.push(`${8_000_000 + index},标题 ${index},Artist ${index},rock`);
    await writeFile(file, `${rows.join("\n")}\n`, "utf8");
    const started = performance.now();
    const parsed = await readBatchInput(file);
    expect(parsed).toHaveLength(count);
    expect(performance.now() - started).toBeLessThan(10_000);
  });
});
