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
});
