import { describe, expect, it } from "vitest";

import {
  comparePartialDates,
  createPartialDate,
  partialDateSortKey,
  type PartialDate,
} from "@/domain/partial-date";

const day = (year: number, month: number, value: number): PartialDate => ({
  year,
  month,
  day: value,
  precision: "DAY",
});

describe("createPartialDate", () => {
  it("rejects non-object input with a structured type issue", () => {
    expect(createPartialDate("invalid")).toMatchObject({
      ok: false,
      issues: [{ code: "INVALID_TYPE" }],
    });
  });

  it.each([
    { year: 2024, month: 2, day: 29, precision: "DAY" },
    { year: 2024, month: 2, day: null, precision: "MONTH" },
    { year: 2024, month: null, day: null, precision: "YEAR" },
    { year: null, month: null, day: null, precision: "UNKNOWN" },
  ])("accepts the valid $precision shape", (input) => {
    expect(createPartialDate(input)).toEqual({ ok: true, value: input });
  });

  it("rejects impossible calendar days without using a synthetic fallback", () => {
    expect(createPartialDate(day(2023, 2, 29))).toMatchObject({
      ok: false,
      issues: [{ path: "day", code: "INVALID_DATE" }],
    });
  });

  it("applies century leap-year rules without timezone behavior", () => {
    expect(createPartialDate(day(2000, 2, 29))).toMatchObject({ ok: true });
    expect(createPartialDate(day(1900, 2, 29))).toMatchObject({
      ok: false,
      issues: [{ code: "INVALID_DATE" }],
    });
  });

  it("rejects values that contradict the declared precision", () => {
    expect(
      createPartialDate({ year: 2024, month: 1, day: null, precision: "YEAR" }),
    ).toMatchObject({ ok: false, issues: [{ path: "month", code: "UNEXPECTED_VALUE" }] });
  });

  it.each([0, 13])("rejects month %s", (month) => {
    expect(createPartialDate({ year: 2024, month, day: null, precision: "MONTH" })).toMatchObject({
      ok: false,
      issues: [{ path: "month", code: "OUT_OF_RANGE" }],
    });
  });

  it.each([
    { year: 2024, month: 1, day: 0 },
    { year: 2024, month: 4, day: 31 },
  ])("rejects an out-of-range day $year-$month-$day", (input) => {
    expect(createPartialDate({ ...input, precision: "DAY" })).toMatchObject({ ok: false });
  });
});

describe("partial date sorting", () => {
  const unknown: PartialDate = { year: null, month: null, day: null, precision: "UNKNOWN" };

  it("uses precision-aware stable tuples", () => {
    expect(partialDateSortKey({ year: 2024, month: null, day: null, precision: "YEAR" })).toEqual([
      2024, 0, 0, 1,
    ]);
    expect(partialDateSortKey(day(2024, 3, 2))).toEqual([2024, 3, 2, 3]);
  });

  it("places unknown dates last in both sort directions", () => {
    expect(comparePartialDates(unknown, day(2024, 1, 1), "ASC")).toBeGreaterThan(0);
    expect(comparePartialDates(unknown, day(2024, 1, 1), "DESC")).toBeGreaterThan(0);
  });

  it("reverses known date order for descending sort", () => {
    expect(comparePartialDates(day(2023, 1, 1), day(2024, 1, 1), "ASC")).toBeLessThan(0);
    expect(comparePartialDates(day(2023, 1, 1), day(2024, 1, 1), "DESC")).toBeGreaterThan(0);
  });

  it("compares identical partial dates as equal", () => {
    expect(comparePartialDates(day(2024, 3, 2), day(2024, 3, 2), "ASC")).toBe(0);
  });
});
