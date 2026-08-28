import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("R12-C family-specific openings", () => {
  it("assigns a distinct product-role opening to every corrected family", () => {
    const roles = new Map([
      ["src/app/discover/page.tsx", "inventory"],
      ["src/app/for-you/page.tsx", "taste-to-album"],
      ["src/app/new-releases/page.tsx", "ux-recent-compatibility"],
      ["src/app/settings/page.tsx", "local-utility"],
    ]);
    for (const [file, role] of roles) {
      const page = source(file);
      expect(page).toContain(`data-opening-role="${role}"`);
      expect(page).not.toContain("r12-page-intro--compact");
    }
    expect(new Set(roles.values()).size).toBe(roles.size);
  });

  it("keeps chronology, taxonomy, search, and utility evidence in the opening structure", () => {
    expect(source("src/app/decades/page.tsx")).toContain("年代浏览已合并到专辑目录");
    expect(source("src/app/genres/page.tsx")).toContain("流派已经回到专辑目录");
    expect(source("src/app/genres/page.tsx")).toContain('href="/discover"');
    expect(source("src/components/search/global-search.tsx")).toContain('type="search"');
    expect(source("src/components/settings/settings-panel.tsx")).toContain('data-utility-block="local-data"');
  });

  it("preserves the existing recommendation, search, and settings behavior contracts", () => {
    expect(source("src/components/recommendations/recommendation-catalog.tsx")).toContain('context="FOR_YOU"');
    expect(source("src/components/search/global-search.tsx")).toContain("searchAlbums");
    const settings = source("src/components/settings/settings-panel.tsx");
    for (const behavior of ["exportJson", "importJson", "window.confirm", "reset()", "TasteSetup"]) expect(settings).toContain(behavior);
  });
});
