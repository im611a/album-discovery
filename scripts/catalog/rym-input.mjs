import { cleanStructuredHeader, readStructuredRows } from "./structured-input.mjs";

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

const cleanHeader = cleanStructuredHeader;

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

export async function* readRymInputRows(file) {
  yield* readStructuredRows(file);
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
