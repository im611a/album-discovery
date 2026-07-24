import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExploreCatalog } from "./explore-catalog";

const push = vi.fn();
let query = "mode=genre";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("@/features/personal-state/personal-state-provider", () => ({
  usePersonalState: () => ({
    state: {
      dismissedAlbumIds: [], likedAlbumIds: [], favoriteAlbumIds: [], savedAlbumIds: [],
      listenedAlbumIds: [], recommendationFeedback: {},
    },
    hydrated: true,
    toggleAlbum: vi.fn(),
    setFeedback: vi.fn(),
  }),
}));

describe("ExploreCatalog", () => {
  beforeEach(() => { push.mockClear(); query = "mode=genre"; });

  it("renders all five exploration modes and real results", () => {
    render(<ExploreCatalog />);
    for (const label of ["流派漫游", "年代穿梭", "聆听场景", "艺人接力", "随机一张"]) expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
  });

  it("writes a stable URL when the selection changes", () => {
    render(<ExploreCatalog />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: screen.getByRole("combobox").querySelectorAll("option")[1]?.value } });
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/explore\?mode=genre&value=/), { scroll: false });
  });

  it("restores random mode from URL and exposes its seed", () => {
    query = "mode=random&seed=shared-42";
    render(<ExploreCatalog />);
    expect(screen.getByDisplayValue("shared-42")).toBeInTheDocument();
    expect(screen.getByText(/1 张稳定随机结果/)).toBeInTheDocument();
  });

  it("falls back safely for invalid parameters", () => {
    query = "mode=invalid&value=missing";
    render(<ExploreCatalog />);
    expect(screen.getByRole("link", { name: "流派漫游" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
  });
});
