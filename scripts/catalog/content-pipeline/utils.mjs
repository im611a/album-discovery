import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const sha256File = async (file) => sha256Bytes(await readFile(file));

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export const stableJson = (value, spacing = 2) => `${JSON.stringify(stableValue(value), null, spacing)}\n`;
export const fingerprint = (value) => sha256Bytes(stableJson(value, 0));

export function normalizeComparison(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function uniqueStable(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "en-US", { numeric: true }));
}
