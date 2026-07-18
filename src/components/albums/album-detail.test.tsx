import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { AlbumDetail } from "./album-detail";

const renderDetail = (slug: string) => render(<PersonalStateProvider><AlbumDetail album={catalogAlbums.find((album) => album.slug === slug)!} /></PersonalStateProvider>);

describe("AlbumDetail", () => {
  it("shows verified metadata, actions, guide, track list and secure outbound links", async () => {
    renderDetail("hounds-of-love");
    expect(screen.getByRole("heading", { level: 1, name: "Hounds of Love" })).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: "想听" })).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "曲目表" })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link").filter((item) => item.getAttribute("target") === "_blank")) expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows honest missing states instead of inventing tracks or destinations", () => {
    const album = catalogAlbums.find((item) => item.tracks.length === 0 && item.externalLinks.length === 0)!;
    render(<PersonalStateProvider><AlbumDetail album={album} /></PersonalStateProvider>);
    expect(screen.getByText("曲目表暂未收录；不会用其他版本或占位曲目替代。")).toBeInTheDocument();
    expect(screen.getByText("暂无可验证的直达链接。")).toBeInTheDocument();
  });

  it("keeps taxonomy links on the established discover URL contract", () => {
    renderDetail("in-rainbows");
    expect(screen.getByRole("link", { name: "独立摇滚" })).toHaveAttribute("href", "/discover?genre=indie-rock");
  });
});
