import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@/components/homepage-production/runtime/mount-runtime.js", () => ({
  mountHomepageRuntime: vi.fn(() => vi.fn()),
}));

describe("production homepage shell", () => {
  it("renders one route-aware interface, 24 gallery albums, and one six-album stage", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "专辑发现" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-gallery-index]")).toHaveLength(24);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(container.querySelectorAll("[data-stage-vinyl-index]")).toHaveLength(0);
    expect(container.querySelector("[data-stage-count='6']")).toBeInTheDocument();
    expect(container.querySelector(".site-header")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "探索" })).not.toBeInTheDocument();
  });

  it("uses real routes and album detail links", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "目录" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "推荐" })).toHaveAttribute("href", "/for-you");
    expect(screen.getAllByRole("link", { name: /查看《.+》专辑详情/ })).toHaveLength(24);
  });

  it("keeps the active Stage above outgoing Gallery artwork", () => {
    const css = readFileSync(join(process.cwd(), "src/components/homepage-production/homepage-production.css"), "utf8");
    expect(css).toMatch(/\.ad-stage\s*\{[\s\S]*?z-index:\s*10;[\s\S]*?background:\s*var\(--ad-bg\);/);
  });

  it("keeps every vinyl inside its Three.js sleeve group instead of the viewport", () => {
    const css = readFileSync(join(process.cwd(), "src/components/homepage-production/homepage-production.css"), "utf8");
    const scene = readFileSync(join(process.cwd(), "src/components/homepage-production/runtime/stage/stage-scene.js"), "utf8");
    const runtime = readFileSync(join(process.cwd(), "src/components/homepage-production/runtime/stage/stage.js"), "utf8");
    expect(css).not.toContain(".ad-stage__pin::before");
    expect(css).not.toContain(".ad-stage__vinyl-unit");
    expect(scene).toContain("holder.add(vinyl)");
    expect(scene).toContain("group.add(holder, cover)");
    expect(scene).toContain("createAlbumVinylTexture(THREE, item.vinylPalette");
    expect(scene).not.toContain("neutral-vinyl.svg");
    expect(runtime).toContain("group.userData.vinyl.rotation.z");
    expect(runtime).toContain("group.userData.spin +=");
  });

  it("renders the record as a near-black grooved medium with a restrained album label", () => {
    const materials = readFileSync(
      join(process.cwd(), "src/components/homepage-production/runtime/stage/stage-materials.js"),
      "utf8",
    );
    expect(materials).toContain('body.addColorStop(0.58, "#111315")');
    expect(materials).toContain("for (let radius = 92; radius <= 238; radius += 7)");
    expect(materials).toContain("label.addColorStop(0, palette.light)");
    expect(materials).toContain("context.moveTo(center + 31, center - 28)");
    expect(materials).not.toContain("drawImage");
  });
});
