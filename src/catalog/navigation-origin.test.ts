import { describe, expect, it } from "vitest";
import {
  appendNavigationOrigin,
  buildNavigationReturnHref,
  buildSearchOriginHref,
  parseNavigationOrigin,
  serializeNavigationOrigin,
} from "./navigation-origin";

describe("R15 canonical navigation origin", () => {
  it("round-trips a bounded Library context without album or state identifiers", () => {
    const origin = parseNavigationOrigin("lfrom=library&lview=favorite&lq=ambient&lsort=title");
    expect(origin).toEqual({ kind: "LIBRARY", view: "favorite", query: "ambient", sort: "title" });
    expect(serializeNavigationOrigin(origin).toString()).toBe("lfrom=library&lview=favorite&lq=ambient&lsort=title");
    expect(buildNavigationReturnHref(origin)).toBe("/library?view=favorite&q=ambient&sort=title");
  });

  it("round-trips Search query and page while preserving discovery parameters", () => {
    const href = buildSearchOriginHref("/albums/example?entry=album%3Aseed&via=genre", "Björk", 3);
    expect(href).toContain("entry=album%3Aseed");
    expect(href).toContain("sfrom=search");
    const origin = parseNavigationOrigin(href.split("?")[1]);
    expect(buildNavigationReturnHref(origin)).toBe("/search?q=Bj%C3%B6rk&page=3");
  });

  it("rejects ambiguous dual provenance rather than inventing authority", () => {
    const input = "lfrom=library&sfrom=search&lview=saved&sq=test";
    expect(parseNavigationOrigin(input)).toEqual({ kind: "NONE" });
    expect(appendNavigationOrigin("/albums/example", input)).toBe("/albums/example");
  });

  it("bounds hostile values and keeps replay deterministic", () => {
    const long = "x".repeat(400);
    const origin = parseNavigationOrigin(`sfrom=search&sq=${long}&spage=999999`);
    expect(origin).toEqual({ kind: "SEARCH", query: "x".repeat(100), page: 1 });
    const first = appendNavigationOrigin("/artists/example", origin);
    expect(appendNavigationOrigin(first, origin)).toBe(first);
  });

  it("settles repeated cross-surface propagation without URL growth", () => {
    let href = "/albums/example?entry=album%3Aseed&trail=seed&via=artist";
    const origin = parseNavigationOrigin("lfrom=library&lview=recent&lq=long%20title&lsort=release-newest");
    for (let index = 0; index < 30_000; index += 1) href = appendNavigationOrigin(href, origin);
    expect(href.length).toBeLessThan(512);
    expect((href.match(/lfrom=/g) ?? [])).toHaveLength(1);
    expect(buildNavigationReturnHref(parseNavigationOrigin(href.split("?")[1]))).toBe("/library?view=recent&q=long+title&sort=release-newest");
  });
});
