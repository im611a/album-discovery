import { describe, expect, it } from "vitest";

import {
  validateRymImportRow,
  validateRymNormalizedRow,
  type RymNormalizedRow,
} from "@/providers/rym/contracts";
import { parseUtcIsoTimestamp } from "@/domain/sources";

const normalizedRow: RymNormalizedRow = {
  sourceRowKey: "synthetic-row-1",
  sourceAlbumReference: null,
  title: "Synthetic Offline Album",
  aliases: [],
  artists: ["Synthetic Offline Artist"],
  releaseDate: { year: 2024, month: null, day: null, precision: "YEAR" },
  rating: null,
  ratingCount: null,
  primaryGenres: ["Synthetic Primary Genre"],
  secondaryGenres: ["Synthetic Secondary Genre"],
  descriptors: ["Synthetic Descriptor"],
  observedAt: null,
};

describe("RYM offline row contracts", () => {
  it("accepts an opaque near-raw local row without freezing file column names", () => {
    expect(
      validateRymImportRow({ rowNumber: 1, rawColumns: { arbitrary_source_column: "value" } }),
    ).toEqual([]);
  });

  it("rejects an invalid source row number", () => {
    expect(validateRymImportRow({ rowNumber: 0, rawColumns: {} })).toMatchObject([
      { code: "INVALID_ROW_NUMBER" },
    ]);
  });

  it("rejects rawColumns values that are not records", () => {
    // @ts-expect-error The runtime validator must reject an array supplied across an untyped boundary.
    expect(validateRymImportRow({ rowNumber: 1, rawColumns: [] })).toMatchObject([
      { code: "INVALID_RAW_COLUMNS" },
    ]);
  });

  it("accepts missing rating fields as null", () => {
    expect(validateRymNormalizedRow(normalizedRow)).toEqual([]);
  });

  it("preserves explicitly supplied zero rating values", () => {
    expect(validateRymNormalizedRow({ ...normalizedRow, rating: 0, ratingCount: 0 })).toEqual([]);
  });

  it("does not freeze an unverified upper rating range in 0.3A", () => {
    expect(validateRymNormalizedRow({ ...normalizedRow, rating: 99 })).toEqual([]);
  });

  it("requires ratingCount to remain a non-negative integer", () => {
    expect(validateRymNormalizedRow({ ...normalizedRow, ratingCount: -1 })).toMatchObject([
      { code: "INVALID_RATING_COUNT" },
    ]);
  });

  it("reports blank text, invalid dates, and non-finite ratings", () => {
    const issues = validateRymNormalizedRow({
      ...normalizedRow,
      title: " ",
      releaseDate: { year: 2023, month: 2, day: 29, precision: "DAY" },
      rating: Number.POSITIVE_INFINITY,
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["BLANK_VALUE", "INVALID_DATE", "INVALID_RATING"]),
    );
  });

  it("propagates PartialDate type, range, and precision-shape issues", () => {
    expect(
      validateRymNormalizedRow({
        ...normalizedRow,
        releaseDate: { year: 0, month: null, day: null, precision: "YEAR" },
      }).map((item) => item.code),
    ).toContain("OUT_OF_RANGE");
    expect(
      validateRymNormalizedRow({
        ...normalizedRow,
        releaseDate: { year: 2024, month: 1, day: null, precision: "YEAR" },
      }).map((item) => item.code),
    ).toContain("UNEXPECTED_VALUE");
    const invalidDateType = { ...normalizedRow, releaseDate: "invalid" };
    // @ts-expect-error Runtime validation must reject an invalid value from an untyped boundary.
    expect(validateRymNormalizedRow(invalidDateType).map((item) => item.code)).toContain(
      "INVALID_TYPE",
    );
  });

  it("accepts null observedAt and rejects non-canonical non-null values", () => {
    expect(validateRymNormalizedRow({ ...normalizedRow, observedAt: null })).toEqual([]);
    const invalidRow = { ...normalizedRow, observedAt: "2026-07-17T00:00:00Z" };
    // @ts-expect-error The runtime validator must reject an unbranded timestamp from an input boundary.
    expect(validateRymNormalizedRow(invalidRow)).toMatchObject([
      { path: "observedAt", code: "INVALID_UTC_FORMAT" },
    ]);
    const valid = parseUtcIsoTimestamp("2026-07-17T00:00:00.000Z");
    if (!valid.ok) throw new Error("Expected a valid UTC timestamp.");
    expect(validateRymNormalizedRow({ ...normalizedRow, observedAt: valid.value })).toEqual([]);
  });

  it("keeps primary, secondary, and descriptor arrays separate and ordered", () => {
    expect(normalizedRow.primaryGenres).toEqual(["Synthetic Primary Genre"]);
    expect(normalizedRow.secondaryGenres).toEqual(["Synthetic Secondary Genre"]);
    expect(normalizedRow.descriptors).toEqual(["Synthetic Descriptor"]);
  });
});
