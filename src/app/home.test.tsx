import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";
import { GlobalSearchProvider } from "@/components/search/global-search";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";

vi.mock("@/components/homepage-production/runtime/mount-runtime.js", () => ({
  mountHomepageRuntime: vi.fn(() => vi.fn()),
}));

describe("production homepage shell", () => {
  const renderHome = () => render(
    <PersonalStateProvider>
      <GlobalSearchProvider><Home /></GlobalSearchProvider>
    </PersonalStateProvider>,
  );
  it("renders one route-aware interface, 24 gallery albums, and one six-album stage", () => {
    const { container } = renderHome();
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
    renderHome();
    expect(screen.getByRole("link", { name: "目录" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "推荐" })).toHaveAttribute("href", "/for-you");
    expect(screen.getByRole("link", { name: "查看《Madvillainy》专辑详情" })).toHaveAttribute("href", "/albums/madvillainy?pfrom=home");
    expect(screen.getAllByRole("button", { name: /选择《.+》作为黑胶标签/ })).toHaveLength(24);
  });

  it("selects one gallery album and exposes its accessible detail action", () => {
    const { container } = renderHome();
    expect(screen.getByRole("heading", { name: "从《Madvillainy》继续" })).toBeInTheDocument();
    const next = screen.getAllByRole("button", { name: /选择《.+》作为黑胶标签/ }).find((button) => button.getAttribute("aria-pressed") === "false")!;
    fireEvent.click(next);
    expect(next).toHaveAttribute("aria-pressed", "true");
    const selectedId = next.closest("[data-album-id]")?.getAttribute("data-album-id");
    expect(container.querySelector(`.ad-poster[data-album-id="${selectedId}"]`)).toHaveClass("is-selected");
    expect(container.querySelector(".ad-marker")).not.toHaveAttribute("data-vinyl-label", "madvillainy");
    expect(screen.getByRole("link", { name: /查看《.+》专辑详情/ })).toBeInTheDocument();
    expect(container.querySelector(".ad-continuation")).not.toHaveAttribute("data-continuation-source", "madvillainy");
    expect(screen.queryByRole("heading", { name: "从《Madvillainy》继续" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入推荐 ↗" })).toHaveAttribute("href", "/for-you");
  });

  it("keeps the active Stage above outgoing Gallery artwork without covering the ambient field", () => {
    const css = readFileSync(join(process.cwd(), "src/components/homepage-production/homepage-production.css"), "utf8");
    expect(css).toMatch(/\.ad-stage\s*\{[\s\S]*?z-index:\s*10;[\s\S]*?background:\s*transparent;/);
  });

  it("keeps one canonical, non-interactive Stage flow below the WebGL and typography layers", () => {
    const { container } = renderHome();
    const css = readFileSync(join(process.cwd(), "src/components/homepage-production/homepage-production.css"), "utf8");
    const flow = container.querySelector(".ad-stage__flow");
    const canvas = container.querySelector(".ad-stage__canvas");

    expect(container.querySelectorAll(".ad-stage__flow")).toHaveLength(1);
    expect(flow).toHaveAttribute("aria-hidden", "true");
    expect(flow).toHaveAttribute("data-stage-flow", "camera-active-album");
    expect(flow).toHaveAttribute("data-stage-ambient-album-id", "album:29704");
    expect(container.querySelector(".ad-stage")).toHaveAttribute("data-stage-ambient-album-id", "album:29704");
    expect(flow?.nextElementSibling).toBe(canvas);
    expect(css).toMatch(/\.ad-stage__flow\s*\{[\s\S]*?z-index:\s*0;[\s\S]*?var\(--ad-stage-flow-accent\)[\s\S]*?var\(--ad-stage-flow-accent-secondary\)[\s\S]*?pointer-events:\s*none;/);
    expect(css).toMatch(/\.ad-stage__canvas\s*\{[\s\S]*?z-index:\s*1;/);
    expect(css).toMatch(/\.ad-stage__title\s*\{[\s\S]*?z-index:\s*2;/);
  });

  it("interpolates canonical accent colors without restarting the palette from transparent", () => {
    const css = readFileSync(join(process.cwd(), "src/components/homepage-production/homepage-production.css"), "utf8");
    const ambient = readFileSync(
      join(process.cwd(), "src/components/homepage-production/homepage-ambient-flow-field.tsx"),
      "utf8",
    );

    expect(css).toContain("@property --ad-accent");
    expect(css).toContain("@property --ad-flow-accent");
    expect(css).toContain("@property --ad-stage-flow-accent");
    expect(css).toMatch(/--ad-accent 900ms cubic-bezier\(\.22, \.7, \.2, 1\)/);
    expect(css).toMatch(/--ad-flow-accent 1200ms linear/);
    expect(css).toMatch(/--ad-stage-flow-accent 1200ms linear/);
    expect(css).not.toContain("ad-flow-palette-arrive");
    expect(ambient).not.toContain("key={albumId}");
    expect(ambient).not.toContain("paletteStyle");
  });

  it("places the single Chromatic Discovery directly after Stage in semantic document order", () => {
    const { container } = renderHome();
    const order = [...container.querySelectorAll(
      ".ad-gallery, .ad-stage, .ad-chromatic, .r17-recent-return, .ad-continuation, .ad-ending",
    )].map((element) => element.classList[0]);

    expect(order).toEqual([
      "ad-gallery",
      "ad-stage",
      "ad-chromatic",
      "r17-recent-return",
      "ad-continuation",
      "ad-ending",
    ]);
    expect(container.querySelectorAll(".ad-chromatic")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "按封面的颜色翻唱片" })).toBeInTheDocument();
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
