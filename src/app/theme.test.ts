import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const discoverCatalogSource = readFileSync(
  join(process.cwd(), "src/components/discover/discover-catalog.tsx"),
  "utf8",
);
const discoverFiltersSource = readFileSync(
  join(process.cwd(), "src/components/discover/discover-filters.tsx"),
  "utf8",
);

describe("blue-black theme", () => {
  it("defines the shared blue-black design tokens", () => {
    for (const token of [
      "--background: #060a12",
      "--background-secondary: #0a111e",
      "--card: #0d1726",
      "--overlay: #111d2e",
      "--foreground: #f4f7fb",
      "--muted: #9bafc5",
      "--border: #1b2b42",
      "--accent: #70b7ff",
      "--accent-hover: #9acbff",
      "--focus: #70b7ff",
      "--danger: #f0a4a8",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("keeps UI colors out of the discover components", () => {
    expect(discoverCatalogSource).not.toMatch(/#[\da-f]{3,8}/i);
    expect(discoverFiltersSource).not.toMatch(/#[\da-f]{3,8}/i);
  });

  it("keeps home and catalog grids as separate responsive layouts", () => {
    expect(css).toContain(".album-grid--home");
    expect(css).toContain("grid-template-columns: repeat(6, minmax(0, 1fr))");
  });

  it("keeps primary filters visible and hides their summary outside mobile", () => {
    expect(css).toContain(
      ".primary-filters:not([open]) + .primary-filters__content",
    );
    expect(css).toContain(".primary-filters[open] + .primary-filters__content");
    expect(css).toContain(".primary-filters__summary");
  });
});
