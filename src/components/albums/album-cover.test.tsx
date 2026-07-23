import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { AlbumCover } from "./album-cover";

describe("AlbumCover", () => {
  it("renders the downloaded local cover when present", () => {
    render(<AlbumCover album={catalogAlbums[0]} />);
    expect(screen.getByRole("img", { name: catalogAlbums[0].cover.alt })).toHaveAttribute("src", expect.stringContaining(catalogAlbums[0].neteaseAlbumId));
  });

  it("renders an explicit local fallback without inventing an image URL", () => {
    const album = { ...catalogAlbums[0], cover: { kind: "fallback" as const, src: null, alt: "封面暂缺", reason: "cover_download_failed" } };
    render(<AlbumCover album={album} />);
    expect(screen.getByRole("img", { name: "封面暂缺" })).toHaveClass("album-cover--fallback");
    expect(screen.queryByRole("img", { name: "封面暂缺" })?.tagName).toBe("DIV");
  });
});
