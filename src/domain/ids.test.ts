import { describe, expect, expectTypeOf, it } from "vitest";

import {
  parseAlbumId,
  parseArtistId,
  parseImportRunId,
  parseManualOverrideId,
  parseMatchDecisionId,
  parseSyncRunId,
  toExternalDecimalId,
  type AlbumId,
  type ArtistId,
  type ExternalIdentifierId,
  type TrackId,
} from "@/domain/ids";

describe("opaque IDs", () => {
  it("accepts a non-blank provider-independent string without changing it", () => {
    const result = parseAlbumId("album-internal-a1");

    expect(result).toEqual({ ok: true, value: "album-internal-a1" });
  });

  it("uses the same runtime rules for other internal ID kinds", () => {
    expect(parseArtistId("artist-internal-a1").ok).toBe(true);
    expect(parseSyncRunId("sync-run-a1").ok).toBe(true);
    expect(parseImportRunId("import-run-a1").ok).toBe(true);
    expect(parseMatchDecisionId("decision-a1").ok).toBe(true);
    expect(parseManualOverrideId("override-a1").ok).toBe(true);
  });

  it.each(["", "   "])("rejects an empty ID %#", (value) => {
    expect(parseAlbumId(value)).toMatchObject({ ok: false, issue: { code: "EMPTY" } });
  });

  it("rejects surrounding whitespace rather than silently normalizing identity", () => {
    expect(parseAlbumId(" album-internal-a1 ")).toMatchObject({
      ok: false,
      issue: { code: "SURROUNDING_WHITESPACE" },
    });
  });

  it("rejects non-string internal IDs", () => {
    expect(parseAlbumId(710001)).toMatchObject({
      ok: false,
      issue: { code: "NOT_STRING" },
    });
  });

  it("keeps provider-independent ID brands statically isolated", () => {
    expectTypeOf<AlbumId>().not.toEqualTypeOf<ArtistId>();
    expectTypeOf<ArtistId>().not.toEqualTypeOf<TrackId>();
    expectTypeOf<ExternalIdentifierId>().not.toEqualTypeOf<AlbumId>();
  });
});

describe("external decimal ID conversion", () => {
  it("preserves decimal strings, including leading zeroes", () => {
    expect(toExternalDecimalId("00123")).toEqual({ ok: true, value: "00123" });
  });

  it("converts safe integers to decimal strings", () => {
    expect(toExternalDecimalId(123)).toEqual({ ok: true, value: "123" });
  });

  it("rejects unsafe numeric input rather than preserving a rounded value", () => {
    expect(toExternalDecimalId(Number.MAX_SAFE_INTEGER + 1)).toMatchObject({
      ok: false,
      issue: { code: "UNSAFE_INTEGER" },
    });
  });

  it("rejects bigint input with the existing unsupported-type behavior", () => {
    expect(toExternalDecimalId(BigInt(123))).toMatchObject({
      ok: false,
      issue: { code: "UNSUPPORTED_TYPE" },
    });
  });

  it("rejects negative numeric input without treating it as decimal text", () => {
    expect(toExternalDecimalId(-1)).toMatchObject({
      ok: false,
      issue: { code: "NEGATIVE_INTEGER" },
    });
  });

  it.each(["12.5", " 12", "-1", ""])("rejects invalid decimal text %s", (value) => {
    expect(toExternalDecimalId(value)).toMatchObject({
      ok: false,
      issue: { code: "INVALID_DECIMAL_STRING" },
    });
  });
});
