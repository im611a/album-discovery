import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { getTopicAlbums } from "@/catalog/topics";
import { DiscoverCatalogFallback, TopicCatalogFallback } from "./catalog-geometry-fallback";

vi.mock("@/components/album-grid", () => ({
  AlbumGrid: ({ albums, className }: { albums: Array<{ id: string }>; className?: string }) => <div className={className} data-testid="fallback-grid">{albums.map((album) => <span key={album.id} data-testid="fallback-album" />)}</div>,
}));

describe("catalog geometry fallbacks", () => {
  it("reserves the default catalog toolbar, first page grid, and pagination geometry", () => {
    render(<DiscoverCatalogFallback albums={catalogAlbums} />);
    expect(screen.getByLabelText("正在准备专辑目录")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(`${catalogAlbums.length} 张专辑`)).toBeInTheDocument();
    expect(screen.getAllByTestId("fallback-album")).toHaveLength(48);
    expect(screen.getByTestId("fallback-grid")).toHaveClass("r12-catalog-grid");
    expect(screen.getByText(/第 1 \/ .* 页/)).toBeInTheDocument();
  });

  it("reserves the dense topic filters, result count, and first page grid", () => {
    const albums = getTopicAlbums("core", "pop");
    render(<TopicCatalogFallback albums={albums} kind="core" />);
    expect(screen.getByLabelText("正在准备专题目录")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText((_, node) => node?.textContent === `找到 ${albums.length} 张专辑 · 当前显示 48 张`)).toBeInTheDocument();
    expect(screen.getAllByTestId("fallback-album")).toHaveLength(48);
    expect(screen.queryByText("核心流派")).not.toBeInTheDocument();
    expect(screen.getByText("发行类型")).toBeInTheDocument();
    expect(screen.getByText("排序")).toBeInTheDocument();
  });
});
