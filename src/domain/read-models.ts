import type { AlbumType } from "@/domain/catalog";
import type { AlbumId, ArtistId, TrackId } from "@/domain/ids";
import type { PartialDate } from "@/domain/partial-date";
import type { NeteaseMarketChannel, UtcIsoTimestamp } from "@/domain/sources";

export type DataOrigin = "PROTOTYPE_FIXTURE" | "PUBLISHED_SOURCE_DATA";

export interface ArtistCreditSummary {
  readonly id: ArtistId;
  readonly name: string;
}

export type CoverView =
  | {
      readonly kind: "IMAGE";
      readonly url: string;
      readonly alt: string;
    }
  | {
      readonly kind: "PROTOTYPE_ARTWORK";
      readonly alt: string;
      readonly accent: string;
      readonly background: string;
      readonly motif: string;
    }
  | {
      readonly kind: "PLACEHOLDER";
      readonly url: null;
      readonly alt: string;
    };

export interface RymRatingView {
  readonly score: number;
  readonly ratingCount: number;
  readonly observedAt: UtcIsoTimestamp | null;
}

export interface TaxonomyLabel {
  readonly key: string;
  readonly sourceValue: string;
  readonly displayLabel: string;
}

export interface AlbumSummary {
  readonly id: AlbumId;
  readonly origin: DataOrigin;
  readonly slug: string;
  readonly title: string;
  readonly artists: readonly ArtistCreditSummary[];
  readonly releaseDate: PartialDate;
  readonly releaseYear: number | null;
  readonly releaseType: AlbumType;
  readonly cover: CoverView;
  readonly rym: RymRatingView | null;
  readonly primaryGenres: readonly TaxonomyLabel[];
}

export interface TrackView {
  readonly id: TrackId;
  readonly title: string;
  readonly position: number;
  readonly discNumber: number | null;
  readonly trackNumber: number | null;
  readonly artists: readonly ArtistCreditSummary[];
  readonly durationMs: number | null;
}

export interface AlbumDetail extends AlbumSummary {
  readonly aliases: readonly string[];
  readonly releaseCompanies: readonly string[];
  readonly secondaryGenres: readonly TaxonomyLabel[];
  readonly descriptors: readonly TaxonomyLabel[];
  readonly tracks: readonly TrackView[];
  readonly neteaseOutboundUrl: string | null;
  readonly sourceUpdatedAt: UtcIsoTimestamp | null;
}

export interface NewReleaseAlbumSummary extends AlbumSummary {
  readonly sourceMarketChannels: readonly NeteaseMarketChannel[];
  readonly firstDiscoveredAt: UtcIsoTimestamp;
  readonly lastDiscoveredAt: UtcIsoTimestamp;
}

export type AlbumSearchMatchReason =
  | "TITLE_EXACT"
  | "ALIAS_EXACT"
  | "ARTIST_EXACT"
  | "TITLE_PARTIAL"
  | "ALIAS_PARTIAL"
  | "ARTIST_PARTIAL";

export interface AlbumSearchResult {
  readonly album: AlbumSummary;
  readonly matchReason: AlbumSearchMatchReason;
}

export interface ReadModelValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export function validateAlbumSummary(summary: AlbumSummary): readonly ReadModelValidationIssue[] {
  const issues: ReadModelValidationIssue[] = [];
  if (summary.title.trim().length === 0) {
    issues.push({ path: "title", code: "BLANK_TITLE", message: "Album title cannot be blank." });
  }
  if (summary.slug.trim().length === 0) {
    issues.push({ path: "slug", code: "BLANK_SLUG", message: "Album slug cannot be blank." });
  }
  if (summary.releaseYear !== summary.releaseDate.year) {
    issues.push({
      path: "releaseYear",
      code: "RELEASE_YEAR_MISMATCH",
      message: "releaseYear must mirror releaseDate.year.",
    });
  }
  if (summary.origin === "PUBLISHED_SOURCE_DATA" && summary.cover.kind === "PROTOTYPE_ARTWORK") {
    issues.push({
      path: "cover",
      code: "PROTOTYPE_COVER_IN_PUBLISHED_DATA",
      message: "Published source data cannot expose prototype artwork.",
    });
  }
  if (summary.rym !== null) {
    if (!Number.isFinite(summary.rym.score)) {
      issues.push({
        path: "rym.score",
        code: "INVALID_RATING",
        message: "RYM score must be finite.",
      });
    }
    if (!Number.isInteger(summary.rym.ratingCount) || summary.rym.ratingCount < 0) {
      issues.push({
        path: "rym.ratingCount",
        code: "INVALID_RATING_COUNT",
        message: "RYM rating count must be a non-negative integer.",
      });
    }
  }
  return issues;
}
