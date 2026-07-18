import type { AlbumType } from "@/domain/catalog";
import type { NeteaseMarketChannel } from "@/domain/sources";

export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 24;

export interface PageRequest {
  readonly cursor: string | null;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly totalCount: number;
}

export type DiscoverSort =
  | "RELEASE_DATE_DESC"
  | "RELEASE_DATE_ASC"
  | "RYM_SCORE_DESC"
  | "RYM_SCORE_ASC"
  | "RYM_RATING_COUNT_DESC"
  | "RANDOM";

export interface DiscoverQuery {
  readonly decade: string | null;
  readonly releaseType: AlbumType | null;
  readonly primaryGenre: string | null;
  readonly secondaryGenre: string | null;
  readonly descriptor: string | null;
  readonly sort: DiscoverSort;
  readonly page: PageRequest;
}

export interface SearchQuery {
  readonly q: string;
  readonly page: PageRequest;
}

export interface NewReleaseQuery {
  readonly channel: NeteaseMarketChannel;
  readonly releaseType: AlbumType | null;
  readonly page: PageRequest;
}

export interface PageRequestValidationIssue {
  readonly path: "cursor" | "limit";
  readonly code:
    | "INVALID_CURSOR"
    | "INVALID_LIMIT"
    | "LIMIT_EXCEEDED";
  readonly message: string;
}

export function validatePageRequest(request: PageRequest): readonly PageRequestValidationIssue[] {
  const issues: PageRequestValidationIssue[] = [];
  if (request.cursor !== null && request.cursor.trim().length === 0) {
    issues.push({
      path: "cursor",
      code: "INVALID_CURSOR",
      message: "A non-null cursor cannot be blank.",
    });
  }
  if (!Number.isFinite(request.limit) || !Number.isInteger(request.limit) || request.limit < 1) {
    issues.push({
      path: "limit",
      code: "INVALID_LIMIT",
      message: "Page limit must be a positive integer.",
    });
  } else if (request.limit > MAX_PAGE_LIMIT) {
    issues.push({
      path: "limit",
      code: "LIMIT_EXCEEDED",
      message: `Page limit cannot exceed the fixed service maximum of ${MAX_PAGE_LIMIT}.`,
    });
  }
  return issues;
}
