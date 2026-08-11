import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getAlbumBySlug } from "@/catalog/queries";
import { publishedArtists } from "@/catalog/published-catalog";
import {
  buildArtistDiscoveryPresentation,
  buildArtistDiscoveryPresentationFromSearchParams,
  buildTopicDiscoveryPresentation,
} from "@/catalog/discovery/artist-topic-presentation";
import { EntityDiscoveryView } from "./entity-discovery-view";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function required<T>(value: T | null | undefined): T {
  if (!value) throw new Error("Expected discovery fixture to exist.");
  return value;
}

describe("EntityDiscoveryView", () => {
  it("renders one truthful multi-work Artist continuation with unique real Album links", () => {
    const artist = required(publishedArtists.find((candidate) => candidate.albumCount > 1));
    const presentation = required(buildArtistDiscoveryPresentation(artist.artistId));
    const { container } = render(<EntityDiscoveryView presentation={presentation} />);

    expect(presentation.source.shape).toBe("MULTI_WORK");
    expect(screen.getByRole("heading", { level: 2, name: "从作品年表继续" })).toBeInTheDocument();
    expect(screen.getByText(/作品年表仍是这页的事实主体/)).toBeInTheDocument();
    const links = [...container.querySelectorAll<HTMLAnchorElement>(".r13-entity-discovery__primary, .r13-entity-discovery__alternates a")];
    expect(links).toHaveLength(1 + presentation.alternates.length);
    expect(new Set(links.map((link) => link.getAttribute("href"))).size).toBe(links.length);
    expect(links.every((link) => link.pathname.startsWith("/albums/"))).toBe(true);
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(container.querySelectorAll(".album-cover").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img").every((cover) => Boolean(cover.getAttribute("alt") || cover.getAttribute("aria-label")))).toBe(true);
  });

  it("labels a single-work Artist escape without inventing an Artist relationship", () => {
    const artist = required(publishedArtists.find((candidate) => candidate.albumCount === 1));
    const presentation = required(buildArtistDiscoveryPresentation(artist.artistId));
    render(<EntityDiscoveryView presentation={presentation} />);

    expect(presentation.source.shape).toBe("SINGLE_WORK");
    expect(screen.getByRole("heading", { level: 2, name: "从唯一作品向外继续" })).toBeInTheDocument();
    expect(screen.getByText(/不暗示艺人之间存在合作或私人关联/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/相关艺人|相似艺人|合作艺人/);
  });

  it("keeps Topic catalog membership factual and avoids score or ranking language", () => {
    const presentation = required(buildTopicDiscoveryPresentation("core", "alternative-rock"));
    render(<EntityDiscoveryView presentation={presentation} />);

    expect(screen.getByRole("heading", { level: 2, name: "从这一专题继续" })).toBeInTheDocument();
    expect(screen.getByText(/真实成员专辑/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/PRIMARY_GENRE|SECONDARY_GENRE|rank|score|得分|热榜/iu);
  });

  it("shows a bounded incoming path and a canonical reset without changing the source page", () => {
    const album = required(getAlbumBySlug("wake-after-the-rain"));
    const artistId = required(album.artists[0]?.id);
    const presentation = required(buildArtistDiscoveryPresentationFromSearchParams(
      artistId,
      "entry=album&entryKey=wake-after-the-rain&trail=wake-after-the-rain",
    ));
    render(<EntityDiscoveryView presentation={presentation} />);

    expect(screen.getByRole("navigation", { name: "当前发现路径" })).toHaveTextContent("在雨后醒来");
    expect(screen.getByRole("link", { name: "从本页重新开始" })).toHaveAttribute(
      "href",
      `/artists/${presentation.source.slug}`,
    );
    expect(presentation.primary.href).toMatch(/^\/albums\//);
  });
});
