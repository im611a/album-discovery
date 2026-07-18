import { describe, expect, it } from "vitest";

import {
  absent,
  explicitNull,
  invalid,
  isAbsent,
  isExplicitNull,
  isInvalid,
  isPresent,
  parseUtcIsoTimestamp,
  present,
  summarizeRawValue,
  validateExternalIdentifier,
  NETEASE_MARKET_CHANNELS,
  type UtcIsoTimestamp,
} from "@/domain/sources";
import {
  parseAlbumId,
  parseExternalIdentifierId,
  parseArtistId,
} from "@/domain/ids";

function valueOf<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Expected a valid test ID.");
  return result.value;
}

function utc(value: string): UtcIsoTimestamp {
  const result = parseUtcIsoTimestamp(value);
  if (!result.ok) throw new Error("Expected a valid UTC test timestamp.");
  return result.value;
}

describe("parseUtcIsoTimestamp", () => {
  it("accepts and preserves the only canonical millisecond-Z format", () => {
    expect(parseUtcIsoTimestamp("2026-06-19T12:34:56.000Z")).toEqual({
      ok: true,
      value: "2026-06-19T12:34:56.000Z",
    });
  });

  it("accepts and preserves a valid leap-day timestamp", () => {
    expect(parseUtcIsoTimestamp("2024-02-29T00:00:00.000Z")).toEqual({
      ok: true,
      value: "2024-02-29T00:00:00.000Z",
    });
  });

  it("rejects two-digit fractional seconds at the strict format boundary", () => {
    expect(parseUtcIsoTimestamp("2026-06-19T12:34:56.00Z")).toMatchObject({
      ok: false,
      issue: { code: "INVALID_UTC_FORMAT" },
    });
  });

  it.each([
    "2026-06-19T12:34:56Z",
    "2026-06-19T12:34:56.000+08:00",
    "2026-06-19T12:34:56.000",
    "2026-06-19",
    "not-a-time",
    "",
  ])("rejects non-canonical UTC input %s", (value) => {
    expect(parseUtcIsoTimestamp(value)).toMatchObject({
      ok: false,
      issue: { code: "INVALID_UTC_FORMAT" },
    });
  });

  it.each(["2026-13-01T00:00:00.000Z", "2025-02-29T00:00:00.000Z"])(
    "rejects invalid calendar instant %s",
    (value) => {
      expect(parseUtcIsoTimestamp(value)).toMatchObject({
        ok: false,
        issue: { code: "INVALID_UTC_TIMESTAMP" },
      });
    },
  );

  it("rejects non-string input", () => {
    expect(parseUtcIsoTimestamp(null)).toMatchObject({
      ok: false,
      issue: { code: "NOT_STRING" },
    });
  });
});

describe("SourceField", () => {
  it("keeps present, explicit-null, absent, and invalid states separate", () => {
    expect(isPresent(present("value"))).toBe(true);
    expect(isExplicitNull(explicitNull())).toBe(true);
    expect(isAbsent(absent())).toBe(true);
    expect(isInvalid(invalid("bad", "invalid input"))).toBe(true);
  });

  it("summarizes invalid compound and string values without retaining their contents", () => {
    expect(summarizeRawValue("private-looking-value")).toEqual({ kind: "STRING", length: 21 });
    expect(summarizeRawValue({ nested: "value" })).toEqual({ kind: "OBJECT" });
    expect(summarizeRawValue([1, 2])).toEqual({ kind: "ARRAY", length: 2 });
  });

  it("distinguishes a present empty collection from an absent collection", () => {
    expect(present<readonly string[]>([])).toEqual({ state: "PRESENT", value: [] });
    expect(absent<readonly string[]>()).toEqual({ state: "ABSENT" });
  });

  it("retains a controlled invalid reason", () => {
    expect(invalid("bad", "Expected a decimal value.")).toMatchObject({
      state: "INVALID",
      reason: "Expected a decimal value.",
    });
  });
});

describe("NetEase market channel values", () => {
  it("freezes only the observed request-side market channels at runtime", () => {
    expect(NETEASE_MARKET_CHANNELS).toEqual(["ALL", "ZH", "EA", "JP", "KR"]);
    expect(Object.isFrozen(NETEASE_MARKET_CHANNELS)).toBe(true);
    expect(Reflect.set(NETEASE_MARKET_CHANNELS, 0, "UNSUPPORTED")).toBe(false);
    expect(() =>
      Reflect.apply(Array.prototype.push, NETEASE_MARKET_CHANNELS, ["UNSUPPORTED"]),
    ).toThrow(TypeError);
    expect(NETEASE_MARKET_CHANNELS).toEqual(["ALL", "ZH", "EA", "JP", "KR"]);
  });
});

describe("validateExternalIdentifier", () => {
  const base = {
    id: valueOf(parseExternalIdentifierId("external-link-a1")),
    source: "NETEASE" as const,
    entityType: "ALBUM" as const,
    externalId: "710001",
    albumId: valueOf(parseAlbumId("album-internal-a1")),
    artistId: null,
    trackId: null,
    firstObservedAt: utc("2026-07-17T00:00:00.000Z"),
    lastObservedAt: utc("2026-07-17T01:00:00.000Z"),
  };

  it("accepts exactly one matching canonical reference", () => {
    expect(validateExternalIdentifier(base)).toEqual([]);
  });

  it("rejects multiple canonical references", () => {
    const issues = validateExternalIdentifier({
      ...base,
      artistId: valueOf(parseArtistId("artist-internal-a1")),
    });
    expect(issues.map((item) => item.code)).toContain("CANONICAL_REFERENCE_COUNT");
  });

  it("rejects a canonical reference that does not match entityType", () => {
    const issues = validateExternalIdentifier({
      ...base,
      entityType: "ARTIST",
    });
    expect(issues.map((item) => item.code)).toContain("ENTITY_TYPE_MISMATCH");
  });

  it("rejects a missing canonical reference", () => {
    const issues = validateExternalIdentifier({ ...base, albumId: null });
    expect(issues.map((item) => item.code)).toContain("CANONICAL_REFERENCE_COUNT");
  });

  it("rejects a blank external ID", () => {
    expect(validateExternalIdentifier({ ...base, externalId: " " })).toMatchObject([
      { code: "EMPTY_EXTERNAL_ID" },
    ]);
  });

  it("rejects reversed observation times after canonical UTC validation", () => {
    const codes = validateExternalIdentifier({
      ...base,
      firstObservedAt: utc("2026-07-17T02:00:00.000Z"),
      lastObservedAt: utc("2026-07-17T01:00:00.000Z"),
    }).map((item) => item.code);

    expect(codes).toContain("OBSERVATION_ORDER");
    expect(codes).not.toContain("INVALID_UTC_FORMAT");
    expect(codes).not.toContain("INVALID_UTC_TIMESTAMP");
  });

  it("does not compare observation order when firstObservedAt is invalid", () => {
    const invalidIdentifier = {
      ...base,
      firstObservedAt: "z-invalid-time",
    };
    // @ts-expect-error Runtime validation must reject an unbranded timestamp from an input boundary.
    const codes = validateExternalIdentifier(invalidIdentifier).map((item) => item.code);

    expect(codes).toContain("INVALID_UTC_FORMAT");
    expect(codes).not.toContain("OBSERVATION_ORDER");
  });

  it("does not compare observation order when lastObservedAt is invalid", () => {
    const invalidIdentifier = {
      ...base,
      lastObservedAt: "0000-invalid-time",
    };
    // @ts-expect-error Runtime validation must reject an unbranded timestamp from an input boundary.
    const codes = validateExternalIdentifier(invalidIdentifier).map((item) => item.code);

    expect(codes).toContain("INVALID_UTC_FORMAT");
    expect(codes).not.toContain("OBSERVATION_ORDER");
  });

  it("accepts correctly ordered observation times without time or order issues", () => {
    const codes = validateExternalIdentifier({
      ...base,
      firstObservedAt: utc("2026-07-17T00:00:00.000Z"),
      lastObservedAt: utc("2026-07-17T01:00:00.000Z"),
    }).map((item) => item.code);

    expect(codes).not.toContain("INVALID_UTC_FORMAT");
    expect(codes).not.toContain("INVALID_UTC_TIMESTAMP");
    expect(codes).not.toContain("OBSERVATION_ORDER");
  });
});
