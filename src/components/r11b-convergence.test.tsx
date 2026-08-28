import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("R11-B reference translation boundaries", () => {
  it("uses the neutral Album Discovery token family", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    for (const token of ["--ad-bg-immersive", "--ad-bg-primary", "--ad-bg-raised", "--ad-text-primary", "--ad-line-subtle", "--ad-accent-neutral"]) {
      expect(css).toContain(token);
    }
  });

  it("preserves the established pointer response alongside scroll-driven gallery movement", () => {
    const runtime = readFileSync(join(process.cwd(), "src/components/homepage-production/runtime/runtime/scroll-runtime.js"), "utf8");
    expect(runtime).toContain('addEventListener("pointermove", onPointer');
    expect(runtime).toContain('removeEventListener("pointermove", onPointer)');
    expect(runtime).toContain("event.clientX");
    expect(runtime).toContain("ad-poster__pointer");
    expect(runtime).toContain("node.style.transform");
    expect(runtime).toContain("requestAnimationFrame");
  });

  it("keeps advanced catalog filters in document flow", () => {
    const source = readFileSync(join(process.cwd(), "src/components/discover/discover-catalog.tsx"), "utf8");
    expect(source).toContain("catalog-advanced-filters");
    expect(source).toContain("更多筛选");
    expect(source).not.toContain('role="dialog"');
  });

  it("does not restore decorative record-package objects in album detail", () => {
    const source = readFileSync(join(process.cwd(), "src/components/albums/album-detail.tsx"), "utf8");
    expect(source).toContain('<AlbumCover album={album} size="detail" />');
    expect(source).not.toContain("RecordPackage");
  });
});
