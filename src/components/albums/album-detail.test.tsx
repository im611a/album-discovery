import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getAlbumDetailViewModel } from "@/catalog/album-detail-view-model";
import { getAlbumDetailBySlug } from "@/catalog/published-album-details";
import { getAlbumBySlug } from "@/catalog/queries";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { AlbumDetail } from "./album-detail";

const renderDetail = (slug: string) => render(<PersonalStateProvider><AlbumDetail album={getAlbumDetailBySlug(slug)!} /></PersonalStateProvider>);

describe("AlbumDetail", () => {
  it("shows NetEase metadata, local actions, taxonomy, tracks and the single secure outbound destination", async () => {
    renderDetail("wake-after-the-rain");
    expect(screen.getByRole("heading", { level: 1, name: "在雨后醒来" })).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: "想听" })).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "曲目表" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /网易云音乐.*查看专辑与曲目信息/ });
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
    expect(screen.queryByRole("heading", { name: "相关流派" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "氛围与特征" })).not.toBeInTheDocument();
    expect(screen.queryByText("相关流派与氛围特征来自人工核验的离线 RYM 分类快照。")).not.toBeInTheDocument();
  });

  it("keeps stable taxonomy keys in discover links while showing bilingual labels", () => {
    renderDetail("wake-after-the-rain");
    expect(screen.getByRole("link", { name: "嘻哈（Hip Hop）" })).toHaveAttribute("href", "/genres/core/hip-hop");
  });

  it("renders optional RYM related taxonomy without exposing descriptors", () => {
    const album = {
      ...getAlbumDetailBySlug("wake-after-the-rain")!,
      relatedGenres: ["chamber-pop"],
      descriptors: ["lush"],
    };
    render(<PersonalStateProvider><AlbumDetail album={album} /></PersonalStateProvider>);
    expect(screen.getByRole("heading", { name: "相关流派" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "chamber-pop" })).toHaveAttribute("href", "/genres/related/chamber-pop");
    expect(screen.queryByRole("heading", { name: "氛围与特征" })).not.toBeInTheDocument();
    expect(screen.getByText("相关流派来自人工核验的离线 RYM Secondary Genres。")).toBeInTheDocument();
  });

  it("places same-artist albums before recommendations in semantic DOM order", () => {
    const album = getAlbumDetailBySlug("wake-after-the-rain")!;
    const sameArtist = { ...getAlbumBySlug("super-mr-sun")!, id: "album:other", slug: "other-album", title: "同艺人作品" };
    const { container } = render(<PersonalStateProvider><AlbumDetail album={album} sameArtistAlbums={[sameArtist]} /></PersonalStateProvider>);
    const headings = [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
    expect(headings.indexOf("同艺人其他专辑")).toBeLessThan(headings.indexOf("推荐专辑"));
    expect(container.querySelector(".pa-same-artist-shelf")).toBeInTheDocument();
    expect(container.querySelector(".pa-same-artist-shelf .album-grid")).not.toBeInTheDocument();
  });

  it("keeps the object-first reading order from taxonomy and verified rating through editorial and tracks", () => {
    const album = {
      ...getAlbumDetailBySlug("wake-after-the-rain")!,
      rymRating: 4.1,
      rymRatingCount: 1200,
    };
    const { container } = render(<PersonalStateProvider><AlbumDetail album={album} /></PersonalStateProvider>);
    const headings = [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
    expect(headings.indexOf("流派")).toBeLessThan(headings.indexOf("聆听场景"));
    expect(headings.indexOf("聆听场景")).toBeLessThan(headings.indexOf("RYM 社区评分"));
    expect(headings.indexOf("RYM 社区评分")).toBeLessThan(headings.indexOf("为什么值得完整听"));
    expect(headings.indexOf("为什么值得完整听")).toBeLessThan(headings.indexOf("曲目表"));
  });

  it("renders one undistorted album cover as the hero object without decorative package layers", async () => {
    const { container } = render(<PersonalStateProvider><AlbumDetail album={getAlbumDetailBySlug("wake-after-the-rain")!} /></PersonalStateProvider>);
    expect(container.querySelector(".pa-album-file__object .album-cover")).toBeInTheDocument();
    expect(container.querySelector(".pa-album-file__object [data-record-package]")).not.toBeInTheDocument();
    expect(container.querySelector(".pa-album-file__object .record-package__vinyl")).not.toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: "想听" })).length).toBeGreaterThan(0);
  });

  it("renders the view-model recommendation IDs in their existing order", () => {
    const viewModel = getAlbumDetailViewModel("wake-after-the-rain")!;
    const { container } = render(<PersonalStateProvider><AlbumDetail viewModel={viewModel} /></PersonalStateProvider>);
    const hrefs = [...container.querySelectorAll<HTMLAnchorElement>(".pa-album-recommendations .album-card__overlay-link")].map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(viewModel.recommendations.map((album) => `/albums/${album.slug}`));
  });

  it("does not render an empty same-artist section", () => {
    renderDetail("wake-after-the-rain");
    expect(screen.queryByRole("heading", { name: "同艺人其他专辑" })).not.toBeInTheDocument();
  });
});
