import type {
  AlbumId,
  ArtistId,
  CoverAssetId,
  SourceRecordId,
  TaxonomyTermId,
  TrackId,
} from "@/domain/ids";
import { createPartialDate, type PartialDate } from "@/domain/partial-date";
import {
  parseUtcIsoTimestamp,
  type SourceSystem,
  type UtcIsoTimestamp,
} from "@/domain/sources";

export type AlbumType =
  | "ALBUM"
  | "EP"
  | "MIXTAPE"
  | "SOUNDTRACK"
  | "SINGLE"
  | "OTHER"
  | "UNKNOWN";

export interface Album {
  readonly id: AlbumId;
  readonly title: string;
  readonly releaseDate: PartialDate;
  readonly albumType: AlbumType;
  readonly createdAt: UtcIsoTimestamp;
  readonly updatedAt: UtcIsoTimestamp;
}

export interface AlbumSlug {
  readonly albumId: AlbumId;
  readonly slug: string;
  readonly isCurrent: boolean;
  readonly createdAt: UtcIsoTimestamp;
  readonly retiredAt: UtcIsoTimestamp | null;
}

export type AlbumAliasKind = "ALIAS" | "TRANSLATED_TITLE" | "SOURCE_VARIANT";

export interface AlbumAlias {
  readonly id: string;
  readonly albumId: AlbumId;
  readonly value: string;
  readonly kind: AlbumAliasKind;
  readonly position: number;
  readonly sourceRecordId: SourceRecordId | null;
}

export interface Artist {
  readonly id: ArtistId;
  readonly name: string;
  readonly createdAt: UtcIsoTimestamp;
  readonly updatedAt: UtcIsoTimestamp;
}

export interface ArtistAlias {
  readonly id: string;
  readonly artistId: ArtistId;
  readonly value: string;
  readonly position: number;
  readonly sourceRecordId: SourceRecordId | null;
}

export interface AlbumArtistCredit {
  readonly albumId: AlbumId;
  readonly artistId: ArtistId;
  readonly position: number;
  readonly creditedName: string | null;
}

export interface TrackArtistCredit {
  readonly trackId: TrackId;
  readonly artistId: ArtistId;
  readonly position: number;
  readonly creditedName: string | null;
}

export interface Track {
  readonly id: TrackId;
  readonly albumId: AlbumId;
  readonly title: string;
  readonly position: number;
  readonly discNumber: number | null;
  readonly trackNumber: number | null;
  readonly durationMs: number | null;
  readonly createdAt: UtcIsoTimestamp;
  readonly updatedAt: UtcIsoTimestamp;
}

export interface ReleaseCompanyCredit {
  readonly id: string;
  readonly albumId: AlbumId;
  readonly displayName: string;
  readonly position: number;
  readonly sourceRecordId: SourceRecordId | null;
}

export type CoverAssetStatus = "REMOTE_ONLY" | "CACHED" | "UNAVAILABLE" | "FAILED";

export interface CoverAsset {
  readonly id: CoverAssetId;
  readonly albumId: AlbumId;
  readonly source: SourceSystem;
  readonly sourceUrl: string | null;
  readonly cachedPath: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly variant: string | null;
  readonly status: CoverAssetStatus;
  readonly fetchedAt: UtcIsoTimestamp | null;
}

export type TaxonomyKind = "PRIMARY_GENRE" | "SECONDARY_GENRE" | "DESCRIPTOR";

export interface TaxonomyTerm {
  readonly id: TaxonomyTermId;
  readonly source: "RYM";
  readonly kind: TaxonomyKind;
  readonly sourceValue: string;
  readonly stableKey: string;
}

export interface TaxonomyLabelTranslation {
  readonly termId: TaxonomyTermId;
  readonly locale: string;
  readonly label: string;
}

export interface CatalogValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function validateNonBlank(
  value: string,
  path: string,
  issues: CatalogValidationIssue[],
): void {
  if (isBlank(value)) {
    issues.push({ path, code: "BLANK_VALUE", message: `${path} cannot be blank.` });
  }
}

function validatePositiveInteger(
  value: number,
  path: string,
  issues: CatalogValidationIssue[],
): void {
  if (!Number.isInteger(value) || value < 1) {
    issues.push({
      path,
      code: "INVALID_POSITION",
      message: `${path} must be a positive integer.`,
    });
  }
}

function validateNullablePositiveInteger(
  value: number | null,
  path: string,
  issues: CatalogValidationIssue[],
): void {
  if (value !== null) validatePositiveInteger(value, path, issues);
}

function validateNullableDimension(
  value: number | null,
  path: string,
  issues: CatalogValidationIssue[],
): void {
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    issues.push({
      path,
      code: "INVALID_DIMENSION",
      message: `${path} must be a positive integer or null.`,
    });
  }
}

function validateTimestamp(
  value: UtcIsoTimestamp,
  path: string,
  issues: CatalogValidationIssue[],
): void {
  const result = parseUtcIsoTimestamp(value);
  if (!result.ok) {
    issues.push({ path, code: result.issue.code, message: result.issue.message });
  }
}

function validateNullableTimestamp(
  value: UtcIsoTimestamp | null,
  path: string,
  issues: CatalogValidationIssue[],
): void {
  if (value !== null) validateTimestamp(value, path, issues);
}

function validateUniquePositions(
  values: readonly { readonly position: number }[],
  path: string,
  issues: CatalogValidationIssue[],
): void {
  const seen = new Set<number>();
  values.forEach((value, index) => {
    validatePositiveInteger(value.position, `${path}[${index}].position`, issues);
    if (seen.has(value.position)) {
      issues.push({
        path: `${path}[${index}].position`,
        code: "DUPLICATE_POSITION",
        message: `Positions must be unique within ${path}.`,
      });
    }
    seen.add(value.position);
  });
}

export function validateAlbum(album: Album): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(album.title, "title", issues);
  validateNonBlank(album.createdAt, "createdAt", issues);
  validateNonBlank(album.updatedAt, "updatedAt", issues);
  validateTimestamp(album.createdAt, "createdAt", issues);
  validateTimestamp(album.updatedAt, "updatedAt", issues);

  const releaseDateResult = createPartialDate(album.releaseDate);
  if (!releaseDateResult.ok) {
    issues.push(
      ...releaseDateResult.issues.map((issue) => ({
        path: `releaseDate.${issue.path}`,
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  return issues;
}

export function validateAlbumSlug(slug: AlbumSlug): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(slug.slug, "slug", issues);
  validateNonBlank(slug.createdAt, "createdAt", issues);
  validateTimestamp(slug.createdAt, "createdAt", issues);
  validateNullableTimestamp(slug.retiredAt, "retiredAt", issues);
  if (slug.isCurrent && slug.retiredAt !== null) {
    issues.push({
      path: "retiredAt",
      code: "CURRENT_SLUG_RETIRED",
      message: "A current slug cannot have a retirement time.",
    });
  }
  if (!slug.isCurrent && slug.retiredAt === null) {
    issues.push({
      path: "retiredAt",
      code: "HISTORICAL_SLUG_NOT_RETIRED",
      message: "A historical slug must have a retirement time.",
    });
  }
  return issues;
}

export function validateAlbumAlias(alias: AlbumAlias): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(alias.id, "id", issues);
  validateNonBlank(alias.value, "value", issues);
  validatePositiveInteger(alias.position, "position", issues);
  return issues;
}

export function validateArtist(artist: Artist): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(artist.name, "name", issues);
  validateNonBlank(artist.createdAt, "createdAt", issues);
  validateNonBlank(artist.updatedAt, "updatedAt", issues);
  validateTimestamp(artist.createdAt, "createdAt", issues);
  validateTimestamp(artist.updatedAt, "updatedAt", issues);
  return issues;
}

export function validateArtistAlias(alias: ArtistAlias): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(alias.id, "id", issues);
  validateNonBlank(alias.value, "value", issues);
  validatePositiveInteger(alias.position, "position", issues);
  return issues;
}

export function validateAlbumArtistCredits(
  credits: readonly AlbumArtistCredit[],
): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateUniquePositions(credits, "albumArtistCredits", issues);
  credits.forEach((credit, index) => {
    if (credit.creditedName !== null) {
      validateNonBlank(credit.creditedName, `albumArtistCredits[${index}].creditedName`, issues);
    }
  });
  return issues;
}

export function validateTrackArtistCredits(
  credits: readonly TrackArtistCredit[],
): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateUniquePositions(credits, "trackArtistCredits", issues);
  credits.forEach((credit, index) => {
    if (credit.creditedName !== null) {
      validateNonBlank(credit.creditedName, `trackArtistCredits[${index}].creditedName`, issues);
    }
  });
  return issues;
}

export function validateTrack(track: Track): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(track.title, "title", issues);
  validatePositiveInteger(track.position, "position", issues);
  validateNullablePositiveInteger(track.discNumber, "discNumber", issues);
  validateNullablePositiveInteger(track.trackNumber, "trackNumber", issues);
  validateTimestamp(track.createdAt, "createdAt", issues);
  validateTimestamp(track.updatedAt, "updatedAt", issues);
  if (track.durationMs !== null && (!Number.isInteger(track.durationMs) || track.durationMs < 0)) {
    issues.push({
      path: "durationMs",
      code: "INVALID_DURATION",
      message: "durationMs must be a non-negative integer or null.",
    });
  }
  return issues;
}

export function validateReleaseCompanyCredits(
  credits: readonly ReleaseCompanyCredit[],
): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateUniquePositions(credits, "releaseCompanyCredits", issues);
  credits.forEach((credit, index) => {
    validateNonBlank(credit.id, `releaseCompanyCredits[${index}].id`, issues);
    validateNonBlank(credit.displayName, `releaseCompanyCredits[${index}].displayName`, issues);
  });
  return issues;
}

export function validateCoverAsset(cover: CoverAsset): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNullableDimension(cover.width, "width", issues);
  validateNullableDimension(cover.height, "height", issues);
  validateNullableTimestamp(cover.fetchedAt, "fetchedAt", issues);
  if (cover.status === "REMOTE_ONLY" && cover.sourceUrl === null) {
    issues.push({
      path: "sourceUrl",
      code: "MISSING_REMOTE_URL",
      message: "REMOTE_ONLY covers require a source URL.",
    });
  }
  if (cover.status === "CACHED" && cover.cachedPath === null) {
    issues.push({
      path: "cachedPath",
      code: "MISSING_CACHED_PATH",
      message: "CACHED covers require a cached path.",
    });
  }
  return issues;
}

export function validateTaxonomyTerm(term: TaxonomyTerm): readonly CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  validateNonBlank(term.sourceValue, "sourceValue", issues);
  validateNonBlank(term.stableKey, "stableKey", issues);
  return issues;
}
