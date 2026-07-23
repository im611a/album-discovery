import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getAlbumDetailBySlug } from "@/catalog/published-album-details";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { AlbumDetail } from "./album-detail";

const renderDetail = (slug: string) => render(<PersonalStateProvider><AlbumDetail album={getAlbumDetailBySlug(slug)!} /></PersonalStateProvider>);

describe("AlbumDetail", () => {
  it("shows NetEase metadata, local actions, taxonomy, tracks and the single secure outbound destination", async () => {
    renderDetail("wake-after-the-rain");
    expect(screen.getByRole("heading", { level: 1, name: "在雨后醒来" })).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: "想听" })).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "曲目表" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "在网易云音乐中查看 ↗" });
    expect(link).toHaveAttribute("href", "https://music.163.com/#/album?id=287974232");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render a data-transparency or MusicBrainz module", () => {
    renderDetail("super-mr-sun");
    expect(screen.queryByText("数据透明")).not.toBeInTheDocument();
    expect(screen.queryByText(/MusicBrainz|Cover Art Archive/)).not.toBeInTheDocument();
  });

  it.each(["wake-after-the-rain", "super-mr-sun"])("hides unverified related genres and descriptors for %s", (slug) => {
    renderDetail(slug);
    expect(screen.queryByRole("heading", { name: "延伸流派" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "氛围与特征" })).not.toBeInTheDocument();
  });

  it("keeps stable taxonomy keys in discover links while showing bilingual labels", () => {
    renderDetail("wake-after-the-rain");
    expect(screen.getByRole("link", { name: "嘻哈（Hip Hop）" })).toHaveAttribute("href", "/discover?genre=hip-hop");
  });
});
