import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlbumCard } from "@/components/album-card";
import { getAlbumDetailById } from "@/lib/album-details";

import { AlbumDetail } from "./album-detail";

function renderAlbum(albumId: string) {
  const result = getAlbumDetailById(albumId);
  if (!result) throw new Error(`Missing fixture: ${albumId}`);

  return render(<AlbumDetail album={result.album} detail={result.detail} />);
}

describe("AlbumDetail", () => {
  it("shows the album identity and release metadata", () => {
    renderAlbum("mock-001");

    expect(screen.getByRole("heading", { level: 1, name: "纸上月光" })).toBeInTheDocument();
    expect(screen.getByText("Paper Moonlight")).toBeInTheDocument();
    expect(screen.getByText("林岚")).toBeInTheDocument();
    expect(screen.getByText("2026年6月19日")).toBeInTheDocument();
    expect(screen.getByText("微光唱片（虚构）")).toBeInTheDocument();
  });

  it("does not create empty alias or company regions", () => {
    renderAlbum("mock-003");

    expect(document.querySelector(".album-hero__aliases")).not.toBeInTheDocument();
    expect(screen.queryByText("发行公司")).not.toBeInTheDocument();
  });

  it("shows an RYM score and localized rating count when present", () => {
    renderAlbum("mock-011");

    const rating = screen.getByRole("region", { name: "RYM 社区评分" });
    expect(within(rating).getByText("4.05 / 5")).toBeInTheDocument();
    expect(within(rating).getByText(/11[,，]920 人评分/)).toBeInTheDocument();
    expect(within(rating).queryByText(/本站评分/)).not.toBeInTheDocument();
  });

  it("shows the explicit missing RYM rating state", () => {
    renderAlbum("mock-008");

    expect(screen.getByText("暂无 RYM 评分")).toBeInTheDocument();
    expect(screen.queryByText("0.00 / 5")).not.toBeInTheDocument();
  });

  it("separates primary genres, secondary genres, and descriptors", () => {
    renderAlbum("mock-002");

    expect(screen.getByRole("heading", { name: "主流派" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "次要流派" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "描述标签" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "艺术流行" })).toHaveAttribute(
      "href",
      "/discover?primaryGenre=art-pop",
    );
    expect(screen.getByRole("link", { name: "氛围流行" })).toHaveAttribute(
      "href",
      "/discover?secondaryGenre=ambient-pop",
    );
    expect(screen.getByRole("link", { name: "内省" })).toHaveAttribute(
      "href",
      "/discover?descriptor=introspective",
    );
  });

  it("groups a double-disc track list and preserves track order", () => {
    renderAlbum("mock-009");

    expect(screen.getByRole("heading", { name: "Disc 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Disc 2" })).toBeInTheDocument();
    const discTwo = screen.getByRole("region", { name: "Disc 2" });
    const titles = within(discTwo)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("strong")?.textContent);
    expect(titles).toEqual(["穿过无人隧道", "地图边缘", "天亮以后继续走"]);
  });

  it("shows multi-artist track credits and formatted duration", () => {
    renderAlbum("mock-018");

    expect(screen.getByText("周以宁、Aster Choir")).toBeInTheDocument();
    expect(screen.getByText("5:06")).toBeInTheDocument();
  });

  it("renders a disabled NetEase prototype entry without an external href", () => {
    renderAlbum("mock-001");

    const entry = screen.getByRole("link", { name: /在网易云音乐中查看/ });
    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).not.toHaveAttribute("href");
    expect(entry).toHaveTextContent("真实数据接入后启用");
  });

  it("states that all detail content is fictional prototype data", () => {
    renderAlbum("mock-001");

    expect(
      screen.getByText(/当前内容为本地虚构原型数据，不代表任何真实专辑、评分或曲目/),
    ).toBeInTheDocument();
  });

  it("does not expose forbidden detail features or unreliable region fields", () => {
    renderAlbum("mock-001");

    for (const forbidden of ["推荐曲目", "播放按钮", "评论", "收藏", "艺术家国籍", "专辑语言"]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("uses the same cover component with an independent detail size style", () => {
    const result = getAlbumDetailById("mock-001");
    if (!result) throw new Error("Missing fixture");

    const card = render(<AlbumCard album={result.album} />);
    const cardCover = screen.getByRole("img", { name: "纸上月光 的虚构专辑封面" });
    expect(cardCover).toHaveClass("mock-cover", "mock-cover--orbit");
    expect(cardCover).not.toHaveClass("mock-cover--detail");
    card.unmount();

    render(<AlbumDetail album={result.album} detail={result.detail} />);
    const detailCover = screen.getByRole("img", { name: "纸上月光 的虚构专辑封面" });
    expect(detailCover).toHaveClass(
      "mock-cover",
      "mock-cover--orbit",
      "mock-cover--detail",
    );
  });

  it("keeps every detail section rendered instead of hiding content for compact layouts", () => {
    renderAlbum("mock-001");

    for (const heading of [
      "RYM 社区评分",
      "流派与描述",
      "曲目表",
      "网易云音乐",
      "数据来源说明",
    ]) {
      const section = screen.getByRole("region", { name: heading });
      expect(section).not.toHaveAttribute("hidden");
      expect(section).not.toHaveAttribute("aria-hidden", "true");
    }
  });
});
