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

  it("renders all five exploration modes and one explainable relation authority", () => {
    const { container } = render(<ExploreCatalog />);
    for (const label of ["流派漫游", "年代穿梭", "聆听场景", "艺人接力", "随机一张"]) expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "沿一条真实关系进入" })).toBeInTheDocument();
    expect(container.querySelector('[data-explore-authority="relation"]')).toBeInTheDocument();
    expect(container.querySelectorAll(".r13-explore-entry__primary")).toHaveLength(1);
    expect(container.querySelector(".album-grid")).not.toBeInTheDocument();
  });

  it("writes a stable URL when the selection changes", () => {
    render(<ExploreCatalog />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: screen.getByRole("combobox").querySelectorAll("option")[1]?.value } });
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/explore\?mode=genre&value=.+&kind=core$/), { scroll: false });
  });

  it("restores random mode from URL and structurally labels it as serendipity", () => {
    query = "mode=random&seed=shared-42";
    const { container } = render(<ExploreCatalog />);
    expect(screen.queryByDisplayValue("shared-42")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再随机一张" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "偶然进入一张作品" })).toBeInTheDocument();
    expect(container.querySelector('[data-explore-authority="serendipity"]')).toBeInTheDocument();
    expect(container.querySelector('[data-explore-source-kind]')).not.toBeInTheDocument();
    expect(screen.getByText(/这不是相似关系、推荐结论或热度排序/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent("shared-42");
  });

  it("keeps deterministic seed state in the URL while removing it from ordinary presentation", () => {
    query = "mode=random&seed=shared-42";
    const { container } = render(<ExploreCatalog />);
    fireEvent.click(screen.getByRole("button", { name: "再随机一张" }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/explore\?mode=random&seed=\d+$/), { scroll: false });
    expect(container.querySelector('[data-explore-authority="serendipity"]')).toBeInTheDocument();
    expect(container.querySelector('section[data-explore-authority="relation"]')).not.toBeInTheDocument();
  });

  it("falls back safely for invalid parameters", () => {
    query = "mode=invalid&value=missing";
    const { container } = render(<ExploreCatalog />);
    expect(screen.getByRole("link", { name: "流派漫游" })).toHaveAttribute("aria-current", "page");
    expect(container.querySelector('[data-explore-authority="relation"]')).toBeInTheDocument();
  });

  it("preserves secondary-genre identity in the Explore URL", () => {
    render(<ExploreCatalog />);
    const select = screen.getByRole("combobox");
    const related = [...select.querySelectorAll("option")].find((option) => option.value.startsWith("related:"))!;
    fireEvent.change(select, { target: { value: related.value } });
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/explore\?mode=genre&value=.+&kind=related$/),
      { scroll: false },
    );
  });

  it("keeps relation output independent from local dismissal state", () => {
    const { container } = render(<ExploreCatalog />);
    expect(container.querySelector('[data-explore-authority="relation"]')).toBeInTheDocument();
    expect(screen.getByText(/不使用热度、个人偏好或随机数/)).toBeInTheDocument();
  });
});
