import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const cleanStructuredHeader = (value) => String(value ?? "")
  .replace(/^\uFEFF/, "")
  .trim()
  .toLocaleLowerCase("en-US")
  .replace(/[\s-]+/g, "_");

async function* delimitedRows(file, delimiter) {
  const stream = createReadStream(file, { encoding: "utf8", highWaterMark: 64 * 1024 });
  let row = [];
  let cell = "";
  let quoted = false;
  let headers = null;
  let firstCharacter = true;
  const emit = () => {
    row.push(cell);
    cell = "";
    const values = row;
    row = [];
    if (!headers) {
      headers = values.map(cleanStructuredHeader);
      const duplicates = headers.filter((header, index) => !header || headers.indexOf(header) !== index);
      if (duplicates.length) throw new Error(`Delimited input contains empty or duplicate headers: ${[...new Set(duplicates)].join(", ") || "(empty)"}.`);
      return null;
    }
    if (values.length === 1 && !values[0]) return null;
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  };
  for await (const chunkValue of stream) {
    const chunk = firstCharacter ? chunkValue.replace(/^\uFEFF/, "") : chunkValue;
    firstCharacter = false;
    for (let index = 0; index < chunk.length; index += 1) {
      const character = chunk[index];
      if (quoted) {
        if (character === '"' && chunk[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (character === '"') quoted = false;
        else cell += character;
      } else if (character === '"') quoted = true;
      else if (character === delimiter) {
        row.push(cell);
        cell = "";
      } else if (character === "\n") {
        const record = emit();
        if (record) yield record;
      } else if (character !== "\r") cell += character;
    }
  }
  if (quoted) throw new Error("Delimited input ended inside a quoted field.");
  if (cell || row.length) {
    const record = emit();
    if (record) yield record;
  }
}

async function* jsonArrayRows(file) {
  const text = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.records;
  if (!Array.isArray(rows)) throw new Error("JSON input must be an array or an object with a records array.");
  for (const row of rows) yield row;
}

async function* jsonLinesRows(file) {
  const stream = createReadStream(file, { encoding: "utf8" });
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line.replace(/^\uFEFF/, ""));
  }
  if (buffer.trim()) yield JSON.parse(buffer.replace(/^\uFEFF/, ""));
}

export async function* readStructuredRows(file) {
  const extension = path.extname(file).toLocaleLowerCase("en-US");
  if (extension === ".csv") yield* delimitedRows(file, ",");
  else if (extension === ".tsv") yield* delimitedRows(file, "\t");
  else if (extension === ".jsonl" || extension === ".ndjson") yield* jsonLinesRows(file);
  else if (extension === ".json") yield* jsonArrayRows(file);
  else throw new Error(`Unsupported structured input format: ${extension || "(none)"}.`);
}
