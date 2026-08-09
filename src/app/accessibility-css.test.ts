import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve("src/app/globals.css"), "utf8");

describe("global accessibility and responsive CSS", () => {
  it("provides visible keyboard focus and a focusable skip link", () => {
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/\.skip-link:focus/);
  });
  it("honors reduced motion preferences", () => expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/));
  it.each(["1050px", "760px", "390px"])("defines the %s responsive boundary", (width) => expect(css).toContain(`max-width: ${width}`));
  it("uses minmax zero tracks for responsive album grids", () => expect(css).toMatch(/repeat\([^)]*minmax\(0, 1fr\)/));
  it.each([
    "--background",
    "--foreground",
    "--muted",
    "--border",
    "--surface",
    "--focus",
    "--selected",
    "--disabled",
    "--success",
    "--warning",
    "--danger",
    "--page-gutter",
    "--content",
    "--duration-fast",
    "--ease-standard",
  ])("defines the shared R9 token %s", (token) => expect(css).toContain(`${token}:`));
  it("keeps the inner-page header opaque instead of adding glass effects", () => {
    const header = css.match(/\.site-header \{[^}]+\}/)?.[0] ?? "";
    expect(header).toContain("background: var(--page-background)");
    expect(header).not.toContain("backdrop-filter");
  });
});
