declare const opaqueIdBrand: unique symbol;

export type OpaqueId<Kind extends string> = string & {
  readonly [opaqueIdBrand]: Kind;
};

export type AlbumId = OpaqueId<"AlbumId">;
export type ArtistId = OpaqueId<"ArtistId">;
export type TrackId = OpaqueId<"TrackId">;
export type CoverAssetId = OpaqueId<"CoverAssetId">;
export type ExternalIdentifierId = OpaqueId<"ExternalIdentifierId">;
export type SourceRecordId = OpaqueId<"SourceRecordId">;
export type SyncRunId = OpaqueId<"SyncRunId">;
export type ImportRunId = OpaqueId<"ImportRunId">;
export type TaxonomyTermId = OpaqueId<"TaxonomyTermId">;
export type MatchDecisionId = OpaqueId<"MatchDecisionId">;
export type ManualOverrideId = OpaqueId<"ManualOverrideId">;

export interface IdValidationIssue {
  readonly code: "NOT_STRING" | "EMPTY" | "SURROUNDING_WHITESPACE";
  readonly message: string;
}

export type IdParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issue: IdValidationIssue };

function parseOpaqueId<Kind extends string>(value: unknown): IdParseResult<OpaqueId<Kind>> {
  if (typeof value !== "string") {
    return {
      ok: false,
      issue: { code: "NOT_STRING", message: "Internal IDs must be strings." },
    };
  }

  if (value.length === 0 || value.trim().length === 0) {
    return {
      ok: false,
      issue: { code: "EMPTY", message: "Internal IDs cannot be empty." },
    };
  }

  if (value !== value.trim()) {
    return {
      ok: false,
      issue: {
        code: "SURROUNDING_WHITESPACE",
        message: "Internal IDs cannot contain surrounding whitespace.",
      },
    };
  }

  return { ok: true, value: value as OpaqueId<Kind> };
}

export const parseAlbumId = (value: unknown): IdParseResult<AlbumId> =>
  parseOpaqueId<"AlbumId">(value);
export const parseArtistId = (value: unknown): IdParseResult<ArtistId> =>
  parseOpaqueId<"ArtistId">(value);
export const parseTrackId = (value: unknown): IdParseResult<TrackId> =>
  parseOpaqueId<"TrackId">(value);
export const parseCoverAssetId = (value: unknown): IdParseResult<CoverAssetId> =>
  parseOpaqueId<"CoverAssetId">(value);
export const parseExternalIdentifierId = (
  value: unknown,
): IdParseResult<ExternalIdentifierId> => parseOpaqueId<"ExternalIdentifierId">(value);
export const parseSourceRecordId = (value: unknown): IdParseResult<SourceRecordId> =>
  parseOpaqueId<"SourceRecordId">(value);
export const parseSyncRunId = (value: unknown): IdParseResult<SyncRunId> =>
  parseOpaqueId<"SyncRunId">(value);
export const parseImportRunId = (value: unknown): IdParseResult<ImportRunId> =>
  parseOpaqueId<"ImportRunId">(value);
export const parseTaxonomyTermId = (value: unknown): IdParseResult<TaxonomyTermId> =>
  parseOpaqueId<"TaxonomyTermId">(value);
export const parseMatchDecisionId = (value: unknown): IdParseResult<MatchDecisionId> =>
  parseOpaqueId<"MatchDecisionId">(value);
export const parseManualOverrideId = (value: unknown): IdParseResult<ManualOverrideId> =>
  parseOpaqueId<"ManualOverrideId">(value);

export interface ExternalDecimalIdIssue {
  readonly code:
    | "UNSUPPORTED_TYPE"
    | "INVALID_DECIMAL_STRING"
    | "UNSAFE_INTEGER"
    | "NEGATIVE_INTEGER";
  readonly message: string;
}

export type ExternalDecimalIdResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly issue: ExternalDecimalIdIssue };

export function toExternalDecimalId(value: unknown): ExternalDecimalIdResult {
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) {
      return { ok: true, value };
    }

    return {
      ok: false,
      issue: {
        code: "INVALID_DECIMAL_STRING",
        message: "External numeric IDs must be non-empty decimal strings.",
      },
    };
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      return {
        ok: false,
        issue: {
          code: "UNSAFE_INTEGER",
          message: "External numeric IDs supplied as numbers must be safe integers.",
        },
      };
    }
    if (value < 0) {
      return {
        ok: false,
        issue: {
          code: "NEGATIVE_INTEGER",
          message: "External numeric IDs cannot be negative.",
        },
      };
    }
    return { ok: true, value: String(value) };
  }

  return {
    ok: false,
    issue: {
      code: "UNSUPPORTED_TYPE",
      message: "External numeric IDs must be decimal strings or safe integers.",
    },
  };
}
