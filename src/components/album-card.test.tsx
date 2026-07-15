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

    const genres = screen.getByRole("list", { name: "Primary Genres" });
    expect(within(genres).getAllByRole("listitem")).toHaveLength(2);
  });
});
