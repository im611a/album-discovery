import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectRymInput, normalizeRymInputRow, readRymInputRows } from "./rym-input.mjs";

const directories = [];
async function fixture(name, content) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rym-input-"));
  directories.push(directory);
  const file = path.join(directory, name);
  await writeFile(file, content);
  return file;
}
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("RYM offline input reader", () => {
  it("maps UTF-8 BOM CSV fields and quoted genre lists", async () => {
    const file = await fixture("input.csv", "\uFEFFtitle,artist,release_year,release_type,avg_rating,rating_count,primary_genres,secondary_genres\nExample,Artist,2020,album,3.82,100,\"Art Pop, Pop\",\"Dream Pop, Ambient\"\n");
    const report = await inspectRymInput(file, "fixture");
    expect(report.rows).toBe(1);
    expect(report.samples[0]).toMatchObject({ title: "Example", rating: 3.82, ratingCount: 100, secondaryGenres: ["Dream Pop", "Ambient"] });
  });

  it("streams TSV and JSONL records", async () => {
    const tsv = await fixture("input.tsv", "title\tartist\trelease_year\nA\tB\t2020\n");
    const jsonl = await fixture("input.jsonl", "{\"title\":\"A\",\"artist\":\"B\",\"year\":2020}\n{\"title\":\"C\",\"artist\":\"D\",\"year\":2021}\n");
    const tsvRows = []; for await (const row of readRymInputRows(tsv)) tsvRows.push(row);
    const jsonRows = []; for await (const row of readRymInputRows(jsonl)) jsonRows.push(row);
    expect(tsvRows).toHaveLength(1);
    expect(jsonRows).toHaveLength(2);
  });

  it("supports JSON arrays and records envelopes", async () => {
    const array = await fixture("array.json", JSON.stringify([{ title: "A" }]));
    const envelope = await fixture("envelope.json", JSON.stringify({ records: [{ title: "B" }] }));
    const rows = []; for await (const row of readRymInputRows(array)) rows.push(row);
    const envelopeRows = []; for await (const row of readRymInputRows(envelope)) envelopeRows.push(row);
    expect(rows[0].title).toBe("A");
    expect(envelopeRows[0].title).toBe("B");
  });

  it("preserves invalid numeric values for explicit rejection", () => {
    expect(Number.isNaN(normalizeRymInputRow({ title: "A", artist: "B", year: 2020, rating: "bad" }, 1, "fixture").rating)).toBe(true);
    expect(Number.isNaN(normalizeRymInputRow({ title: "A", artist: "B", year: 2020, rating_count: "1.5" }, 1, "fixture").ratingCount)).toBe(true);
  });
});
