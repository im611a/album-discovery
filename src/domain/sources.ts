import type {
  AlbumId,
  ArtistId,
  ExternalIdentifierId,
  TrackId,
} from "@/domain/ids";

declare const utcIsoTimestampBrand: unique symbol;

export type UtcIsoTimestamp = string & {
  readonly [utcIsoTimestampBrand]: "UtcIsoTimestamp";
};

export interface UtcIsoTimestampValidationIssue {
  readonly code: "NOT_STRING" | "INVALID_UTC_FORMAT" | "INVALID_UTC_TIMESTAMP";
  readonly message: string;
}

export type UtcIsoTimestampParseResult =
  | { readonly ok: true; readonly value: UtcIsoTimestamp }
  | { readonly ok: false; readonly issue: UtcIsoTimestampValidationIssue };

const UTC_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function parseUtcIsoTimestamp(value: unknown): UtcIsoTimestampParseResult {
  if (typeof value !== "string") {
    return {
      ok: false,
      issue: { code: "NOT_STRING", message: "UTC timestamps must be strings." },
    };
  }

  if (!UTC_ISO_TIMESTAMP_PATTERN.test(value)) {
    return {
      ok: false,
      issue: {
        code: "INVALID_UTC_FORMAT",
        message: "UTC timestamps must use YYYY-MM-DDTHH:mm:ss.sssZ.",
      },
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    return {
      ok: false,
      issue: {
        code: "INVALID_UTC_TIMESTAMP",
        message: "UTC timestamp components must form a valid instant.",
      },
    };
  }

  return { ok: true, value: value as UtcIsoTimestamp };
}

export type SourceSystem = "NETEASE" | "RYM";
export type ExternalEntityType = "ALBUM" | "ARTIST" | "TRACK";
export type NeteaseMarketChannel = "ALL" | "ZH" | "EA" | "JP" | "KR";
export type ParserVersion = string;
export type MappingVersion = string;

export const NETEASE_MARKET_CHANNELS = Object.freeze([
  "ALL",
  "ZH",
  "EA",
  "JP",
  "KR",
] as const satisfies readonly NeteaseMarketChannel[]);

export interface ExternalIdentifier {
  readonly id: ExternalIdentifierId;
  readonly source: SourceSystem;
  readonly entityType: ExternalEntityType;
  readonly externalId: string;
  readonly albumId: AlbumId | null;
  readonly artistId: ArtistId | null;
  readonly trackId: TrackId | null;
  readonly firstObservedAt: UtcIsoTimestamp;
  readonly lastObservedAt: UtcIsoTimestamp;
}

export type SafeRawValue =
  | number
  | boolean
  | null
  | {
      readonly kind:
        | "STRING"
        | "ARRAY"
        | "OBJECT"
        | "UNDEFINED"
        | "BIGINT"
        | "SYMBOL"
        | "FUNCTION"
        | "NON_FINITE_NUMBER";
      readonly length?: number;
    };

export type SourceField<T> =
  | { readonly state: "PRESENT"; readonly value: T }
  | { readonly state: "EXPLICIT_NULL" }
  | { readonly state: "ABSENT" }
  | { readonly state: "INVALID"; readonly rawValue: SafeRawValue; readonly reason: string };

export const present = <T>(value: T): SourceField<T> => ({ state: "PRESENT", value });
export const explicitNull = <T>(): SourceField<T> => ({ state: "EXPLICIT_NULL" });
export const absent = <T>(): SourceField<T> => ({ state: "ABSENT" });

export function summarizeRawValue(value: unknown): SafeRawValue {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : { kind: "NON_FINITE_NUMBER" };
  }
  if (typeof value === "string") return { kind: "STRING", length: value.length };
  if (Array.isArray(value)) return { kind: "ARRAY", length: value.length };
  if (typeof value === "object") return { kind: "OBJECT" };
  if (typeof value === "undefined") return { kind: "UNDEFINED" };
  if (typeof value === "bigint") return { kind: "BIGINT" };
  if (typeof value === "symbol") return { kind: "SYMBOL" };
  return { kind: "FUNCTION" };
}

export const invalid = <T>(rawValue: unknown, reason: string): SourceField<T> => ({
  state: "INVALID",
  rawValue: summarizeRawValue(rawValue),
  reason,
});

export const isPresent = <T>(field: SourceField<T>): field is { state: "PRESENT"; value: T } =>
  field.state === "PRESENT";
export const isExplicitNull = <T>(
  field: SourceField<T>,
): field is { state: "EXPLICIT_NULL" } => field.state === "EXPLICIT_NULL";
export const isAbsent = <T>(field: SourceField<T>): field is { state: "ABSENT" } =>
  field.state === "ABSENT";
export const isInvalid = <T>(
  field: SourceField<T>,
): field is { state: "INVALID"; rawValue: SafeRawValue; reason: string } =>
  field.state === "INVALID";

export interface SourceValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export function validateExternalIdentifier(
  identifier: ExternalIdentifier,
): readonly SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];
  const canonicalIds = [identifier.albumId, identifier.artistId, identifier.trackId].filter(
    (value) => value !== null,
  );

  if (identifier.externalId.trim().length === 0) {
    issues.push({
      path: "externalId",
      code: "EMPTY_EXTERNAL_ID",
      message: "External identifiers cannot be blank.",
    });
  }

  if (canonicalIds.length !== 1) {
    issues.push({
      path: "albumId|artistId|trackId",
      code: "CANONICAL_REFERENCE_COUNT",
      message: "Exactly one canonical entity reference must be present.",
    });
  }

  const matchesEntityType =
    (identifier.entityType === "ALBUM" && identifier.albumId !== null) ||
    (identifier.entityType === "ARTIST" && identifier.artistId !== null) ||
    (identifier.entityType === "TRACK" && identifier.trackId !== null);

  if (!matchesEntityType) {
    issues.push({
      path: "entityType",
      code: "ENTITY_TYPE_MISMATCH",
      message: "The canonical reference must match the external entity type.",
    });
  }

  const firstObservedAt = parseUtcIsoTimestamp(identifier.firstObservedAt);
  const lastObservedAt = parseUtcIsoTimestamp(identifier.lastObservedAt);

  if (!firstObservedAt.ok) {
    issues.push({
      path: "firstObservedAt",
      code: firstObservedAt.issue.code,
      message: firstObservedAt.issue.message,
    });
  }
  if (!lastObservedAt.ok) {
    issues.push({
      path: "lastObservedAt",
      code: lastObservedAt.issue.code,
      message: lastObservedAt.issue.message,
    });
  }

  if (firstObservedAt.ok && lastObservedAt.ok && firstObservedAt.value > lastObservedAt.value) {
    issues.push({
      path: "lastObservedAt",
      code: "OBSERVATION_ORDER",
      message: "lastObservedAt cannot precede firstObservedAt.",
    });
  }

  return issues;
}
