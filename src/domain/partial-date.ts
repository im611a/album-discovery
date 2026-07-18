export type DatePrecision = "DAY" | "MONTH" | "YEAR" | "UNKNOWN";

export interface PartialDate {
  readonly year: number | null;
  readonly month: number | null;
  readonly day: number | null;
  readonly precision: DatePrecision;
}

export interface PartialDateValidationIssue {
  readonly path: "year" | "month" | "day" | "precision";
  readonly code: "INVALID_TYPE" | "OUT_OF_RANGE" | "UNEXPECTED_VALUE" | "INVALID_DATE";
  readonly message: string;
}

export type PartialDateResult =
  | { readonly ok: true; readonly value: PartialDate }
  | { readonly ok: false; readonly issues: readonly PartialDateValidationIssue[] };

export type PartialDateSortKey = readonly [number, number, number, number];

const PRECISIONS: readonly DatePrecision[] = ["DAY", "MONTH", "YEAR", "UNKNOWN"];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function createPartialDate(input: unknown): PartialDateResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          path: "precision",
          code: "INVALID_TYPE",
          message: "Partial dates must be objects.",
        },
      ],
    };
  }

  const precision = input.precision;
  if (typeof precision !== "string" || !PRECISIONS.includes(precision as DatePrecision)) {
    return {
      ok: false,
      issues: [
        {
          path: "precision",
          code: "INVALID_TYPE",
          message: "Partial date precision is not supported.",
        },
      ],
    };
  }

  const year = input.year;
  const month = input.month;
  const day = input.day;
  const issues: PartialDateValidationIssue[] = [];

  if (precision === "UNKNOWN") {
    for (const [path, value] of [
      ["year", year],
      ["month", month],
      ["day", day],
    ] as const) {
      if (value !== null) {
        issues.push({
          path,
          code: "UNEXPECTED_VALUE",
          message: `${path} must be null when precision is UNKNOWN.`,
        });
      }
    }
  } else if (!isPositiveInteger(year)) {
    issues.push({
      path: "year",
      code: "OUT_OF_RANGE",
      message: "Year must be a positive integer.",
    });
  }

  if (precision === "YEAR") {
    if (month !== null) {
      issues.push({
        path: "month",
        code: "UNEXPECTED_VALUE",
        message: "Month must be null when precision is YEAR.",
      });
    }
    if (day !== null) {
      issues.push({
        path: "day",
        code: "UNEXPECTED_VALUE",
        message: "Day must be null when precision is YEAR.",
      });
    }
  }

  if (precision === "MONTH" || precision === "DAY") {
    if (!isPositiveInteger(month) || month > 12) {
      issues.push({
        path: "month",
        code: "OUT_OF_RANGE",
        message: "Month must be an integer from 1 through 12.",
      });
    }
  }

  if (precision === "MONTH" && day !== null) {
    issues.push({
      path: "day",
      code: "UNEXPECTED_VALUE",
      message: "Day must be null when precision is MONTH.",
    });
  }

  if (precision === "DAY") {
    if (!isPositiveInteger(day)) {
      issues.push({
        path: "day",
        code: "OUT_OF_RANGE",
        message: "Day must be a positive integer.",
      });
    } else if (isPositiveInteger(year) && isPositiveInteger(month) && month <= 12) {
      if (day > daysInMonth(year, month)) {
        issues.push({
          path: "day",
          code: "INVALID_DATE",
          message: "Day is not valid for the supplied year and month.",
        });
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      year: year as number | null,
      month: month as number | null,
      day: day as number | null,
      precision: precision as DatePrecision,
    },
  };
}

export function partialDateSortKey(date: PartialDate): PartialDateSortKey | null {
  if (date.precision === "UNKNOWN" || date.year === null) return null;

  const precisionRank = date.precision === "YEAR" ? 1 : date.precision === "MONTH" ? 2 : 3;
  return [date.year, date.month ?? 0, date.day ?? 0, precisionRank];
}

export function comparePartialDates(
  left: PartialDate,
  right: PartialDate,
  direction: "ASC" | "DESC" = "ASC",
): number {
  const leftKey = partialDateSortKey(left);
  const rightKey = partialDateSortKey(right);

  if (leftKey === null && rightKey === null) return 0;
  if (leftKey === null) return 1;
  if (rightKey === null) return -1;

  for (let index = 0; index < leftKey.length; index += 1) {
    const difference = leftKey[index] - rightKey[index];
    if (difference !== 0) return direction === "ASC" ? difference : -difference;
  }
  return 0;
}
