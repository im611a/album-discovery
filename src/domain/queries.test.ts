import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  validatePageRequest,
  type DiscoverQuery,
  type NewReleaseQuery,
  type PageRequest,
  type SearchQuery,
} from "@/domain/queries";

describe("validatePageRequest", () => {
  it("accepts bounded cursor pagination", () => {
    expect(validatePageRequest({ cursor: "opaque-cursor", limit: DEFAULT_PAGE_LIMIT })).toEqual([]);
    expect(validatePageRequest({ cursor: null, limit: 1 })).toEqual([]);
    expect(validatePageRequest({ cursor: null, limit: MAX_PAGE_LIMIT })).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])("rejects invalid limit %s", (limit) => {
    expect(validatePageRequest({ cursor: null, limit })).toMatchObject([
      { path: "limit", code: "INVALID_LIMIT" },
    ]);
  });

  it("rejects values above the fixed service maximum", () => {
    expect(validatePageRequest({ cursor: null, limit: MAX_PAGE_LIMIT + 1 })).toMatchObject([
      { path: "limit", code: "LIMIT_EXCEEDED" },
    ]);
  });

  it("rejects a blank non-null cursor", () => {
    expect(validatePageRequest({ cursor: " ", limit: 10 })).toMatchObject([
      { path: "cursor", code: "INVALID_CURSOR" },
    ]);
  });

  it("does not expose a caller-controlled maximum-limit parameter", () => {
    expectTypeOf(validatePageRequest).parameters.toEqualTypeOf<[PageRequest]>();
    // @ts-expect-error A second maximum-limit argument is not part of the public API.
    expect(validatePageRequest({ cursor: null, limit: 101 }, 10_000)).toMatchObject([
      { path: "limit", code: "LIMIT_EXCEEDED" },
    ]);
  });

  it("keeps the three taxonomy stable-key inputs separate", () => {
    const query: DiscoverQuery = {
      decade: null,
      releaseType: null,
      primaryGenre: "synthetic-primary-key",
      secondaryGenre: "synthetic-secondary-key",
      descriptor: "synthetic-descriptor-key",
      sort: "RELEASE_DATE_DESC",
      page: { cursor: null, limit: 24 },
    };
    expect(query.primaryGenre).not.toBe(query.secondaryGenre);
    expect(query.descriptor).toBe("synthetic-descriptor-key");
  });

  it("keeps search text and market channel as provider-independent query values", () => {
    expectTypeOf<SearchQuery["q"]>().toEqualTypeOf<string>();
    expectTypeOf<NewReleaseQuery["channel"]>().toEqualTypeOf<"ALL" | "ZH" | "EA" | "JP" | "KR">();
    expectTypeOf<NewReleaseQuery>().not.toHaveProperty("region");
  });
});
