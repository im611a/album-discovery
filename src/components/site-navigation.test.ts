import { describe, expect, it } from "vitest";
import { isNavigationItemActive, siteNavigationGroups } from "./site-navigation";

describe("shared site navigation", () => {
  it("keeps one route contract for homepage and interior shells without Explore", () => {
    const items = siteNavigationGroups.reduce<Array<readonly [string, string]>>(
      (all, group) => [...all, ...group.items],
      [],
    );
    expect(items).toContainEqual(["/discover", "目录"]);
    expect(items).toContainEqual(["/settings", "设置"]);
    expect(items.some(([href, label]) => href === "/explore" || label === "Explore")).toBe(false);
    expect(new Set(items.map(([href]) => href)).size).toBe(items.length);
  });

  it("marks exact and nested routes active without matching siblings", () => {
    expect(isNavigationItemActive("/discover", "/discover")).toBe(true);
    expect(isNavigationItemActive("/discover/curated", "/discover")).toBe(true);
    expect(isNavigationItemActive("/discoveries", "/discover")).toBe(false);
  });
});
