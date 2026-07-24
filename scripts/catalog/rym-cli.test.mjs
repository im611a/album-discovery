import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import catalog from "../../src/data/generated/catalog.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "../..");
const temporary = await mkdtemp(path.join(os.tmpdir(), "rym-cli-"));
const input = path.join(temporary, "input.csv");
const firstAlbum = catalog.albums[0];
await writeFile(
  input,
  `title,artist,release_year,release_type,avg_rating,rating_count,secondary_genres\n"${firstAlbum.title}","${firstAlbum.artists.map((artist) => artist.name).join(" & ")}",${firstAlbum.releaseDate.slice(0, 4)},${firstAlbum.albumType},3.7,25,Dream Pop\n`,
);

afterAll(async () => rm(temporary, { recursive: true, force: true }));

async function digest(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function run(extraArguments) {
  return spawnSync(
    process.execPath,
    ["scripts/catalog/enrich-rym.mjs", "enrich", "--input", input, "--source-id", "fixture:cli", "--dry-run", "--limit", "1", ...extraArguments],
    { cwd: root, encoding: "utf8" },
  );
}

describe("RYM enrichment CLI safety", () => {
  it("keeps the stable publication unchanged during dry-run and resumes from its checkpoint", async () => {
    const protectedFiles = [
      "src/data/generated/catalog.json",
      "src/data/generated/catalog-index.json",
      "scripts/catalog/rym-taxonomy-snapshot.json",
      "data/rym/enrichment-summary.json",
    ];
    const before = await Promise.all(protectedFiles.map((file) => digest(path.join(root, file))));

    const initial = run([]);
    expect(initial.status, initial.stderr).toBe(0);
    expect(initial.stdout).toContain('"dryRun": true');
    expect(initial.stdout).toContain('"resumed": false');

    const resumed = run(["--resume"]);
    expect(resumed.status, resumed.stderr).toBe(0);
    expect(resumed.stdout).toContain('"dryRun": true');
    expect(resumed.stdout).toContain('"resumed": true');

    const after = await Promise.all(protectedFiles.map((file) => digest(path.join(root, file))));
    expect(after).toEqual(before);
  });
});
