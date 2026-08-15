import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBatchInput } from "./input.mjs";
import { readStructuredRows } from "../structured-input.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixture(name, contents) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "content-pipeline-input-"));
  temporary.push(directory);
  const file = path.join(directory, name);
  await writeFile(file, contents, "utf8");
  return file;
}

describe("Content Pipeline structured input", () => {
  it("parses UTF-8 BOM, quoted CSV and minimal operator fields", async () => {
    const file = await fixture("input.csv", '\uFEFFalbum_id,expected_title,expected_artists,core_genres,contexts\n00123,"Long, Album",Artist A|Artist B,rock,night|focus\n');
    const rows = await readBatchInput(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ albumId: "123", expectedTitle: "Long, Album", expectedArtists: ["Artist A", "Artist B"], coreGenres: ["rock"], contexts: ["night", "focus"] });
    expect(rows[0].findings).toEqual([]);
  });

  it("reports missing required fields per row", async () => {
    const file = await fixture("input.csv", "album_id,expected_title,expected_artists,core_genres\n0,,,\n");
    const [row] = await readBatchInput(file);
    expect(row.findings.map((item) => item.code)).toEqual(["INVALID_ALBUM_ID", "MISSING_EXPECTED_TITLE", "MISSING_EXPECTED_ARTISTS", "MISSING_CORE_GENRES"]);
  });

  it("rejects malformed quoted input", async () => {
    const file = await fixture("input.csv", 'album_id,expected_title\n123,"unfinished\n');
    await expect(async () => {
      for await (const _row of readStructuredRows(file)) void _row;
    }).rejects.toThrow("quoted field");
  });

  it("rejects duplicate headers", async () => {
    const file = await fixture("input.csv", "album_id,album_id\n1,2\n");
    await expect(async () => {
      for await (const _row of readStructuredRows(file)) void _row;
    }).rejects.toThrow("duplicate headers");
  });
});
