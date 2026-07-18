import { createPartialDate, type PartialDate } from "@/domain/partial-date";
import { parseUtcIsoTimestamp, type UtcIsoTimestamp } from "@/domain/sources";

export interface RymImportRowDto {
  readonly rowNumber: number;
  readonly rawColumns: Readonly<Record<string, unknown>>;
}

export interface RymNormalizedRow {
  readonly sourceRowKey: string;
  readonly sourceAlbumReference: string | null;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly artists: readonly string[];
  readonly releaseDate: PartialDate;
  readonly rating: number | null;
  readonly ratingCount: number | null;
  readonly primaryGenres: readonly string[];
  readonly secondaryGenres: readonly string[];
  readonly descriptors: readonly string[];
  readonly observedAt: UtcIsoTimestamp | null;
}

export interface RymContractValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateNonBlank(
  value: string,
  path: string,
  issues: RymContractValidationIssue[],
): void {
  if (value.trim().length === 0) {
    issues.push({ path, code: "BLANK_VALUE", message: `${path} cannot be blank.` });
  }
}

function validateStringList(
  values: readonly string[],
  path: string,
  issues: RymContractValidationIssue[],
): void {
  values.forEach((value, index) => validateNonBlank(value, `${path}[${index}]`, issues));
}

export function validateRymImportRow(row: RymImportRowDto): readonly RymContractValidationIssue[] {
  const issues: RymContractValidationIssue[] = [];
  if (!Number.isInteger(row.rowNumber) || row.rowNumber < 1) {
    issues.push({
      path: "rowNumber",
      code: "INVALID_ROW_NUMBER",
      message: "rowNumber must be a positive integer.",
    });
  }
  if (!isRecord(row.rawColumns)) {
    issues.push({
      path: "rawColumns",
      code: "INVALID_RAW_COLUMNS",
      message: "rawColumns must be a record.",
    });
  }
  return issues;
}

export function validateRymNormalizedRow(
  row: RymNormalizedRow,
): readonly RymContractValidationIssue[] {
  const issues: RymContractValidationIssue[] = [];
  validateNonBlank(row.sourceRowKey, "sourceRowKey", issues);
  if (row.sourceAlbumReference !== null) {
    validateNonBlank(row.sourceAlbumReference, "sourceAlbumReference", issues);
  }
  validateNonBlank(row.title, "title", issues);
  validateStringList(row.aliases, "aliases", issues);
  validateStringList(row.artists, "artists", issues);
  validateStringList(row.primaryGenres, "primaryGenres", issues);
  validateStringList(row.secondaryGenres, "secondaryGenres", issues);
  validateStringList(row.descriptors, "descriptors", issues);

  const dateResult = createPartialDate(row.releaseDate);
  if (!dateResult.ok) {
    issues.push(
      ...dateResult.issues.map((issue) => ({
        path: `releaseDate.${issue.path}`,
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  if (row.rating !== null && !Number.isFinite(row.rating)) {
    issues.push({
      path: "rating",
      code: "INVALID_RATING",
      message: "rating must be finite or null; its allowed range is not frozen in 0.3A.",
    });
  }
  if (row.ratingCount !== null && (!Number.isInteger(row.ratingCount) || row.ratingCount < 0)) {
    issues.push({
      path: "ratingCount",
      code: "INVALID_RATING_COUNT",
      message: "ratingCount must be a non-negative integer or null.",
    });
  }
  if (row.observedAt !== null) {
    const timestamp = parseUtcIsoTimestamp(row.observedAt);
    if (!timestamp.ok) {
      issues.push({
        path: "observedAt",
        code: timestamp.issue.code,
        message: timestamp.issue.message,
      });
    }
  }

  return issues;
}
