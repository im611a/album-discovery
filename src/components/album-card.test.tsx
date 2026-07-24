import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { AlbumCard } from "./album-card";

describe("AlbumCard", () => {
  it("links a real album to its detail and exposes local actions without a rating", () => {
    render(<PersonalStateProvider><AlbumCard album={catalogAlbums[0]} reason="与你选择的类型方向重合。" /></PersonalStateProvider>);
    expect(screen.getByRole("link", { name: /专辑导览/ })).toHaveAttribute("href", `/albums/${catalogAlbums[0].slug}`);
    expect(screen.getByRole("button", { name: "想听" })).toBeInTheDocument();
    expect(screen.queryByText(/RYM|评分/)).not.toBeInTheDocument();
  });
  it("lets the containing page choose a continuous h2 or h3 level", () => {
    const { rerender } = render(<PersonalStateProvider><AlbumCard album={catalogAlbums[0]} headingLevel={2} /></PersonalStateProvider>);
    expect(screen.getByRole("heading", { level: 2, name: catalogAlbums[0].title })).toBeInTheDocument();
    rerender(<PersonalStateProvider><AlbumCard album={catalogAlbums[0]} headingLevel={3} /></PersonalStateProvider>);
    expect(screen.getByRole("heading", { level: 3, name: catalogAlbums[0].title })).toBeInTheDocument();
  });
  it("shows at most two core genres with the shared bilingual display mapping", () => {
    const album = { ...catalogAlbums[0], coreGenres: ["hip-hop", "pop", "rock"] };
    render(<PersonalStateProvider><AlbumCard album={album} /></PersonalStateProvider>);
    const group = screen.getByLabelText("专辑核心流派");
    expect(group.children).toHaveLength(2);
    expect(group).toHaveTextContent("嘻哈（Hip Hop）");
    expect(group).toHaveTextContent("流行（Pop）");
    expect(group).not.toHaveTextContent("摇滚（Rock）");
    expect(screen.getByRole("link", { name: "浏览嘻哈（Hip Hop）专题" })).toHaveAttribute("href", "/genres/core/hip-hop");
    expect(screen.getByRole("link", { name: "浏览流行（Pop）专题" })).toHaveAttribute("href", "/genres/core/pop");
  });
});
