import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { sha256Bytes, sha256File } from "./utils.mjs";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export function unwrapPayloadRecord(value, sourcePath = "payload") {
  if (value?.payload && typeof value.sha256 === "string") {
    const actual = sha256Bytes(JSON.stringify(value.payload));
    if (actual !== value.sha256) throw Object.assign(new Error(`Payload hash mismatch: ${sourcePath}`), { code: "PAYLOAD_HASH_MISMATCH" });
    return { payload: value.payload, adapter: "HASH_WRAPPED_SYNC_CACHE", fetchedAt: value.fetchedAt ?? null };
  }
  if (value?.album) return { payload: value, adapter: "LEGACY_RAW_NETEASE_PAYLOAD", fetchedAt: null };
  throw Object.assign(new Error(`Unsupported local payload shape: ${sourcePath}`), { code: "UNSUPPORTED_PAYLOAD_SHAPE" });
}

export async function loadLocalPayload(albumId, roots) {
  const names = [`album-${albumId}.json`, `${albumId}.json`, `netease-album-${albumId}.json`];
  for (const root of roots) {
    for (const name of names) {
      const file = path.resolve(root, name);
      if (!(await exists(file))) continue;
      const bytes = await readFile(file);
      const parsed = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
      const unwrapped = unwrapPayloadRecord(parsed, file);
      return { ...unwrapped, file, fileSha256: await sha256File(file) };
    }
  }
  throw Object.assign(new Error(`No authoritative local payload found for Album ${albumId}.`), { code: "SOURCE_PAYLOAD_MISSING" });
}
