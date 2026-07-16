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
const homeSource = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
const albumDetailSource = readFileSync(
  join(process.cwd(), "src/components/albums/album-detail.tsx"),
  "utf8",
);

const media640Start = css.indexOf("@media (min-width: 640px)");
const media760Start = css.indexOf("@media (min-width: 760px)");
const media1120Start = css.indexOf("@media (min-width: 1120px)");
const reducedMotionStart = css.indexOf(
  "@media (prefers-reduced-motion: reduce)",
);
const baseStyles = css.slice(0, media640Start);
const media640Styles = css.slice(media640Start, media760Start);
const media1120Styles = css.slice(media1120Start, reducedMotionStart);

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

  it("keeps hard-coded colors inside token and mock-cover definitions", () => {
    const uiRules = css
      .replace(/:root\s*\{[^}]*\}/, "")
      .replace(/\.mock-cover\s*\{[^}]*\}/, "");

    expect(uiRules).not.toMatch(/#[\da-f]{3,8}\b/i);
  });

  it("keeps each responsive breakpoint in a single media query", () => {
    const responsiveQueries = [
      ...css.matchAll(/@media \(min-width: (\d+)px\)/g),
    ].map((match) => match[1]);

    expect(responsiveQueries).toEqual(["640", "760", "1000", "1120"]);
    expect(new Set(responsiveQueries).size).toBe(responsiveQueries.length);
  });

  it("keeps important overrides confined to reduced-motion safeguards", () => {
    expect(reducedMotionStart).toBeGreaterThan(-1);
    expect(css.slice(0, reducedMotionStart)).not.toContain("!important");
    expect(css.slice(reducedMotionStart).match(/!important/g)).toHaveLength(2);
  });

  it("keeps visible focus treatment and balanced heading wrapping", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{[^}]*(?:outline:)[^}]*(?:outline-offset:)/,
    );
    expect(css).not.toMatch(
      /:focus-visible\s*\{[^}]*outline\s*:\s*(?:0|none)/,
    );
    expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*text-wrap: balance/);
  });

  it("keeps header controls touchable with active feedback", () => {
    expect(css).toMatch(
      /\.primary-nav a,\s*\.search-entry\s*\{[^}]*min-height:/,
    );
    expect(css).toContain(".primary-nav a:active");
    expect(css).toContain(".search-entry:active");
  });

  it("keeps home and catalog grids as separate responsive layouts", () => {
    expect(baseStyles).toMatch(
      /\.album-grid\s*\{[^}]*grid-template-columns: repeat\(2,/,
    );
    expect(media640Styles).toMatch(
      /\.album-grid\s*\{[^}]*grid-template-columns: repeat\(4,/,
    );
    expect(media640Styles).toMatch(
      /\.album-grid--home\s*\{[^}]*grid-template-columns: repeat\(3,/,
    );
    expect(media1120Styles).toMatch(
      /\.album-grid\s*\{[^}]*grid-template-columns: repeat\(6,/,
    );
    expect(media1120Styles).toMatch(
      /\.album-grid--home\s*\{[^}]*grid-template-columns: repeat\(6,/,
    );
  });

  it("shares catalog page spacing and heading hierarchy", () => {
    expect(css).toMatch(
      /\.search-main,\s*\.discover-main,\s*\.new-releases-main\s*\{/,
    );
    expect(css).toMatch(
      /\.search-intro h1,\s*\.discover-intro h1,\s*\.new-releases-intro h1\s*\{/,
    );
  });

  it("keeps primary filters visible and hides their summary outside mobile", () => {
    expect(css).toContain(
      ".primary-filters:not([open]) + .primary-filters__content",
    );
    expect(css).toContain(".primary-filters[open] + .primary-filters__content");
    expect(css).toContain(".primary-filters__summary");
  });

  it("styles home genre entries with existing theme tokens", () => {
    expect(homeSource).toContain('className="genre-exploration__list"');
    expect(homeSource).not.toMatch(/#[\da-f]{3,8}/i);
    expect(css).toContain(".genre-exploration__list");
    expect(css).toContain("background: var(--card)");
    expect(css).toContain("border: 1px solid var(--border)");
  });

  it("reduces rating emphasis without hiding rating content", () => {
    expect(albumDetailSource).toContain('className="album-rating__value"');
    expect(albumDetailSource).toContain("RYM 社区评分");
    expect(albumDetailSource).not.toMatch(/#[\da-f]{3,8}/i);
    expect(css).not.toMatch(
      /\.album-rating(?:__[\w-]+)?\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/,
    );
  });
});
