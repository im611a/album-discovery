import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FIELD_ALIASES = {
  title: ["title", "album", "album_name", "release", "release_name", "albumtitle"],
  artist: ["artist", "artists", "artist_name", "artist_names", "albumartist"],
  releaseDate: ["release_date", "releasedate", "date", "year", "release_year"],
  releaseType: ["release_type", "type", "album_type"],
  rating: ["avg_rating", "average_rating", "rating", "rym_rating"],
  ratingCount: ["rating_count", "total_rating", "number_of_ratings", "ratings", "rym_rating_count"],
  primaryGenres: ["primary_genres", "pr_genres", "primarygenres"],
  secondaryGenres: ["secondary_genres", "sec_genres", "secondarygenres"],
  descriptors: ["descriptors", "tags"],
  reference: ["rym_url", "rym_reference", "url", "link", "links"],
};

const cleanHeader = (value) => String(value ?? "")
  .replace(/^\uFEFF/, "")
  .trim()
  .toLocaleLowerCase("en")
  .replace(/[\s-]+/g, "_");

function mappedValue(row, aliases) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function nullable(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return !normalized || /^(?:na|n\/a|none|null|unknown|\[\])$/i.test(normalized) ? null : normalized;
}

function list(value) {
  const normalized = nullable(value);
  if (!normalized) return [];
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {
      // Fall through to delimiter parsing.
    }
  }
  return normalized.split(/\s*(?:\||;|,(?![^[]*\]))\s*/).map((item) => item.trim()).filter(Boolean);
}

function numeric(value, integer = false) {
  const normalized = nullable(value);
  if (normalized == null) return null;
  const number = Number(normalized.replace(/,/g, ""));
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) return Number.NaN;
  return number;
}

function releaseYear(value) {
  return nullable(value)?.match(/(?:19|20)\d{2}/)?.[0] ?? null;
}

function releaseType(value) {
  const normalized = nullable(value)?.toLocaleLowerCase("en").replace(/[^a-z]/g, "") ?? "";
  if (["album", "lp"].includes(normalized)) return "album";
  if (["ep", "extendedplay"].includes(normalized)) return "ep";
  if (["mixtape", "mix"].includes(normalized)) return "mixtape";
  if (["soundtrack", "ost"].includes(normalized)) return "soundtrack";
  if (["single"].includes(normalized)) return "single";
  return normalized || null;
}

export function normalizeRymInputRow(input, rowNumber, inputSourceId) {
  const row = Object.fromEntries(Object.entries(input).map(([key, value]) => [cleanHeader(key), value]));
  const title = nullable(mappedValue(row, FIELD_ALIASES.title));
  const artist = nullable(mappedValue(row, FIELD_ALIASES.artist));
  const rating = numeric(mappedValue(row, FIELD_ALIASES.rating));
  const ratingCount = numeric(mappedValue(row, FIELD_ALIASES.ratingCount), true);
  const reference = nullable(mappedValue(row, FIELD_ALIASES.reference));
  return {
    rowNumber,
    title,
    artist,
    releaseYear: releaseYear(mappedValue(row, FIELD_ALIASES.releaseDate)),
    releaseType: releaseType(mappedValue(row, FIELD_ALIASES.releaseType)),
    rating,
    ratingCount,
    primaryGenres: list(mappedValue(row, FIELD_ALIASES.primaryGenres)),
    secondaryGenres: list(mappedValue(row, FIELD_ALIASES.secondaryGenres)),
    descriptors: list(mappedValue(row, FIELD_ALIASES.descriptors)),
    reference: reference?.startsWith("https://rateyourmusic.com/")
      ? reference
      : `${inputSourceId}:row:${rowNumber}`,
  };
}

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
      headers = values.map(cleanHeader);
      return null;
    }
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
        } else if (character === '"') {
          quoted = false;
        } else {
          cell += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === delimiter) {
        row.push(cell);
        cell = "";
      } else if (character === "\n") {
        const record = emit();
        if (record) yield record;
      } else if (character !== "\r") {
        cell += character;
      }
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

export async function* readRymInputRows(file) {
  const extension = path.extname(file).toLocaleLowerCase("en");
  if (extension === ".csv") yield* delimitedRows(file, ",");
  else if (extension === ".tsv") yield* delimitedRows(file, "\t");
  else if (extension === ".jsonl" || extension === ".ndjson") yield* jsonLinesRows(file);
  else if (extension === ".json") yield* jsonArrayRows(file);
  else throw new Error(`Unsupported RYM input format: ${extension || "(none)"}.`);
}

export async function inspectRymInput(file, inputSourceId, sampleLimit = 3) {
  let rows = 0;
  const samples = [];
  const fields = new Set();
  for await (const raw of readRymInputRows(file)) {
    rows += 1;
    Object.keys(raw).forEach((field) => fields.add(cleanHeader(field)));
    if (samples.length < sampleLimit) samples.push(normalizeRymInputRow(raw, rows, inputSourceId));
  }
  return { rows, fields: [...fields], samples };
}
