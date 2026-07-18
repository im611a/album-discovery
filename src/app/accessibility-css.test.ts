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
});
