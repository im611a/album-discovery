import { describe, expect, it } from "vitest";
import { isNavigationItemActive, siteNavigationGroups } from "./site-navigation";

describe("shared site navigation", () => {
  it("keeps one route contract for homepage and interior shells without Explore", () => {
    const items: Array<{ kind: "link"; href: string; label: string } | { kind: "search"; label: string }> = [];
    for (const group of siteNavigationGroups) items.push(...group.items);
    expect(items).toContainEqual({ kind: "link", href: "/discover", label: "目录" });
    expect(items).toContainEqual({ kind: "search", label: "搜索" });
    expect(items.some((item) => item.kind === "link" && item.href === "/decades")).toBe(false);
    expect(items.some((item) => item.kind === "link" && item.href === "/genres")).toBe(false);
    expect(items.some((item) => item.kind === "link" && item.href === "/new-releases")).toBe(false);
    expect(items.some((item) => item.kind === "link" && item.href === "/explore")).toBe(false);
    const links = items.filter((item): item is Extract<typeof item, { kind: "link" }> => item.kind === "link");
    expect(new Set(links.map((item) => item.href)).size).toBe(links.length);
  });

  it("marks exact and nested routes active without matching siblings", () => {
    expect(isNavigationItemActive("/discover", "/discover")).toBe(true);
    expect(isNavigationItemActive("/discover/curated", "/discover")).toBe(true);
    expect(isNavigationItemActive("/discoveries", "/discover")).toBe(false);
  });
});
