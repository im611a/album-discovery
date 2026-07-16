import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { albumsMock } from "@/data/albums.mock";
import {
  DEFAULT_DISCOVER_STATE,
  buildDiscoverOptions,
  filterAndSortAlbums,
  getDiscoverTaxonomyHref,
} from "@/lib/album-filters";
import { byHighestRating } from "@/lib/albums";
import { getDisplayLabel } from "@/lib/display-labels";
import {
  V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT,
  V0_2_HOME_PRIMARY_GENRES,
} from "@/lib/site";

import Home from "./page";

const discoverOptions = buildDiscoverOptions(albumsMock);

describe("Home", () => {
  it("renders the converged discovery sections", () => {
    render(<Home />);

    for (const heading of ["近期发行", "高分专辑", "按流派探索", "随机发现"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: "最近收录" })).not.toBeInTheDocument();
  });

  it("renders six albums in each remaining home catalog grid", () => {
    render(<Home />);

    for (const heading of ["近期发行", "高分专辑"]) {
      const section = screen.getByRole("region", { name: heading });

      expect(within(section).getAllByRole("article")).toHaveLength(6);
      expect(section.querySelector(".album-grid--home")).toBeInTheDocument();
    }
  });

  it("renders every stable genre entry with the shared display label and URL", () => {
    render(<Home />);

    const section = screen.getByRole("region", { name: "按流派探索" });
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(V0_2_HOME_PRIMARY_GENRES.length);

    for (const sourceLabel of V0_2_HOME_PRIMARY_GENRES) {
      expect(
        within(section).getByRole("link", { name: getDisplayLabel(sourceLabel) }),
      ).toHaveAttribute(
        "href",
        getDiscoverTaxonomyHref("primaryGenre", sourceLabel),
      );
    }
  });

  it("keeps every configured genre in the stable primary options with results", () => {
    for (const sourceLabel of V0_2_HOME_PRIMARY_GENRES) {
      const option = discoverOptions.primaryGenres.find(
        (candidate) => candidate.label === sourceLabel,
      );

      expect(option).toBeDefined();
      expect(option?.value).not.toBe(getDisplayLabel(sourceLabel));

      const results = filterAndSortAlbums(
        albumsMock,
        { ...DEFAULT_DISCOVER_STATE, primaryGenre: option?.value ?? null },
        discoverOptions,
      );
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it("shows six high-rated albums that all meet the v0.2 mock threshold", () => {
    render(<Home />);

    const section = screen.getByRole("region", { name: "高分专辑" });
    const expectedAlbums = byHighestRating(
      albumsMock,
      V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT,
    ).slice(0, 6);

    expect(expectedAlbums).toHaveLength(6);
    expect(
      expectedAlbums.every(
        (album) =>
          album.rymRatingCount >= V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT,
      ),
    ).toBe(true);
    for (const album of expectedAlbums) {
      expect(
        within(section).getByRole("link", {
          name: `查看《${album.title}》专辑详情`,
        }),
      ).toBeInTheDocument();
    }
  });

  it("does not backfill high-rated albums below the mock threshold", () => {
    render(<Home />);

    const section = screen.getByRole("region", { name: "高分专辑" });
    const excluded = byHighestRating(albumsMock).filter(
      (album) => album.rymRatingCount < V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT,
    );

    for (const album of excluded) {
      expect(within(section).queryByText(album.title)).not.toBeInTheDocument();
    }
  });

  it("links the recent releases section to the new releases page", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "查看全部" })).toHaveAttribute(
      "href",
      "/new-releases",
    );
  });

  it("changes the deterministic random discovery album", () => {
    render(<Home />);

    const section = screen.getByRole("region", { name: "随机发现" });
    const initialAlbum = within(section).getByRole("heading", { level: 3 }).textContent;

    fireEvent.click(within(section).getByRole("button", { name: "换一张" }));

    expect(within(section).getByRole("heading", { level: 3 })).not.toHaveTextContent(
      initialAlbum ?? "",
    );
  });

  it("links the current random discovery result to its detail route", () => {
    render(<Home />);

    const section = screen.getByRole("region", { name: "随机发现" });
    const initialHref = within(section)
      .getByRole("link", { name: "查看专辑详情" })
      .getAttribute("href");

    fireEvent.click(within(section).getByRole("button", { name: "换一张" }));

    const nextHref = within(section)
      .getByRole("link", { name: "查看专辑详情" })
      .getAttribute("href");
    expect(initialHref).toMatch(/^\/albums\//);
    expect(nextHref).toMatch(/^\/albums\//);
    expect(nextHref).not.toBe(initialHref);
  });

  it("does not add popularity or domestic and foreign sections", () => {
    render(<Home />);

    for (const prohibitedText of ["热度", "国内精选", "国外精选"]) {
      expect(screen.queryByText(prohibitedText, { exact: false })).not.toBeInTheDocument();
    }
  });
});
