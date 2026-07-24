import { describe, expect, it } from "vitest";
import { createCacheRecord, isPlatformVerification, parseArguments, validateCacheRecord } from "./sync-catalog.mjs";

describe("catalog sync CLI safety contracts", () => {
  it("parses offline and cache verification modes without enabling publication", () => {
    expect(parseArguments(["--offline", "--dry-run", "--limit", "10"])).toMatchObject({ offline: true, dryRun: true, limit: 10 });
    expect(parseArguments(["--verify-cache"])).toMatchObject({ verifyCache: true, dryRun: false });
  });
  it("classifies platform verification responses separately from album data", () => {
    expect(isPlatformVerification({ code: -460, message: "需要验证" })).toBe(true);
    expect(isPlatformVerification({ album: { id: 1 }, songs: [] })).toBe(false);
  });
  it("accepts cache records with fetched time and matching hash", () => {
    const payload = { album: { id: 1 } };
    const record = createCacheRecord(payload, "2026-07-24T00:00:00.000Z");
    expect(validateCacheRecord(record)).toEqual(payload);
    expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects a corrupted cache record", () => {
    const record = createCacheRecord({ album: { id: 1 } });
    expect(() => validateCacheRecord({ ...record, payload: { album: { id: 2 } } })).toThrow("hash mismatch");
  });
});
