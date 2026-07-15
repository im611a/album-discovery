import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { albumsMock } from "@/data/albums.mock";

import { AlbumCard } from "./album-card";

describe("AlbumCard", () => {
  it("shows title, artist, year, and RYM score", () => {
    render(<AlbumCard album={albumsMock[1]} />);

    expect(screen.getByRole("heading", { name: "Before the Rain" })).toBeInTheDocument();
    expect(screen.getByText("June Atlas")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("RYM 4.02")).toBeInTheDocument();
  });

  it("does not invent a score when mock score data is missing", () => {
    render(<AlbumCard album={albumsMock[7]} />);

    expect(screen.queryByText(/^RYM /)).not.toBeInTheDocument();
  });

  it("shows no more than two primary genres", () => {
    render(<AlbumCard album={albumsMock[8]} />);

    const genres = screen.getByRole("list", { name: "主流派" });
    expect(within(genres).getAllByRole("listitem")).toHaveLength(2);
  });

  it("uses the shared Chinese display labels for source genres", () => {
    render(<AlbumCard album={albumsMock[3]} />);

    const genres = screen.getByRole("list", { name: "主流派" });
    expect(within(genres).getByText("另类节奏布鲁斯")).toBeInTheDocument();
    expect(within(genres).getByText("电子")).toBeInTheDocument();
  });

  it("links the whole card to the stable album detail slug", () => {
    render(<AlbumCard album={albumsMock[0]} />);

    const link = screen.getByRole("link", { name: "查看《纸上月光》专辑详情" });
    expect(link).toHaveAttribute("href", "/albums/paper-moonlight");
    expect(link).toContainElement(screen.getByRole("heading", { name: "纸上月光" }));
  });
});
