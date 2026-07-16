import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { albumsMock } from "@/data/albums.mock";

import { SearchCatalog } from "./search-catalog";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

function renderCatalog(query = "") {
  navigation.query = query;
  return render(<SearchCatalog albums={albumsMock} />);
}

function submitQuery(value: string) {
  fireEvent.change(screen.getByLabelText("搜索专辑或艺术家"), {
    target: { value },
  });
  fireEvent.submit(screen.getByRole("search"));
}

describe("SearchCatalog", () => {
  beforeEach(() => {
    navigation.query = "";
    navigation.push.mockReset();
  });

  it("shows the initial state without q", () => {
    renderCatalog();

    expect(
      screen.getByRole("heading", { name: "从一个名字开始搜索" }),
    ).toBeInTheDocument();
  });

  it("does not show album results without q", () => {
    renderCatalog();

    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.queryByText(/张专辑/)).not.toBeInTheDocument();
  });

  it("restores the decoded URL query in the input", () => {
    renderCatalog("q=Before+the+Rain");

    expect(screen.getByLabelText("搜索专辑或艺术家")).toHaveValue(
      "Before the Rain",
    );
  });

  it("shows the result count for a matching query", () => {
    renderCatalog("q=%E6%9E%97%E5%B2%9A");

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("张专辑")).toBeInTheDocument();
  });

  it("shows the empty state for a query without matches", () => {
    renderCatalog("q=not-found-here");

    expect(
      screen.getByRole("heading", { name: "没有找到匹配专辑" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空搜索" })).toBeInTheDocument();
  });

  it("submits by clicking the real submit button", () => {
    renderCatalog();

    const input = screen.getByLabelText("搜索专辑或艺术家");
    const form = screen.getByRole("search");
    const submitButton = screen.getByRole("button", { name: "搜索" });

    expect(submitButton).toHaveAttribute("type", "submit");
    expect(form).toContainElement(submitButton);

    fireEvent.change(input, { target: { value: "纸上月光" } });
    expect(input).toHaveValue("纸上月光");
    fireEvent.click(submitButton);

    expect(navigation.push).toHaveBeenCalledWith(
      "/search?q=%E7%BA%B8%E4%B8%8A%E6%9C%88%E5%85%89",
      { scroll: false },
    );
  });

  it("submits through the native form event used by Enter", () => {
    renderCatalog();

    const input = screen.getByLabelText("搜索专辑或艺术家");
    const form = screen.getByRole("search");

    fireEvent.change(input, { target: { value: "Before the Rain" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.submit(form);

    expect(navigation.push).toHaveBeenCalledWith("/search?q=Before+the+Rain", {
      scroll: false,
    });
  });

  it("does not reset the controlled input before submission", () => {
    renderCatalog("q=Rain");

    const input = screen.getByLabelText("搜索专辑或艺术家");
    const form = screen.getByRole("search");

    fireEvent.change(input, { target: { value: "Mirror City" } });
    expect(input).toHaveValue("Mirror City");

    fireEvent.submit(form);

    expect(input).toHaveValue("Mirror City");
    expect(navigation.push).toHaveBeenCalledWith("/search?q=Mirror+City", {
      scroll: false,
    });
  });

  it.each([
    ["纸上月光", "/search?q=%E7%BA%B8%E4%B8%8A%E6%9C%88%E5%85%89"],
    ["soft place", "/search?q=soft+place"],
    ["rock & roll", "/search?q=rock+%26+roll"],
    ["A+B", "/search?q=A%2BB"],
  ])("encodes the query %s with URLSearchParams", (query, expectedUrl) => {
    renderCatalog();
    submitQuery(query);

    expect(navigation.push).toHaveBeenCalledWith(expectedUrl, { scroll: false });
  });

  it("trims surrounding whitespace before navigation", () => {
    renderCatalog();
    submitQuery("  Before the Rain  ");

    expect(navigation.push).toHaveBeenCalledWith("/search?q=Before+the+Rain", {
      scroll: false,
    });
  });

  it("navigates to /search for an empty submitted query", () => {
    renderCatalog();
    submitQuery("   ");

    expect(navigation.push).toHaveBeenCalledWith("/search", { scroll: false });
  });

  it("clears the current query", () => {
    renderCatalog("q=Rain");

    fireEvent.click(screen.getByRole("button", { name: "清空关键词" }));

    expect(screen.getByLabelText("搜索专辑或艺术家")).toHaveValue("");
    expect(navigation.push).toHaveBeenCalledWith("/search", { scroll: false });
  });

  it("uses scroll false for search navigation", () => {
    renderCatalog();
    submitQuery("Mirror City");

    expect(navigation.push).toHaveBeenCalledWith("/search?q=Mirror+City", {
      scroll: false,
    });
  });

  it("synchronizes the input when searchParams change", () => {
    const view = renderCatalog("q=Rain");
    navigation.query = "q=%E7%BA%B8%E4%B8%8A%E6%9C%88%E5%85%89";

    view.rerender(<SearchCatalog albums={albumsMock} />);

    expect(screen.getByLabelText("搜索专辑或艺术家")).toHaveValue("纸上月光");
    expect(
      screen.getByRole("heading", { name: "“纸上月光”的搜索结果" }),
    ).toBeInTheDocument();
  });

  it("renders results through the shared catalog AlbumGrid", () => {
    const { container } = renderCatalog("q=Rain");

    expect(container.querySelector(".album-grid")).toBeInTheDocument();
    expect(container.querySelector(".album-grid--home")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".album-card")).toHaveLength(2);
  });

  it("keeps the existing album detail slug link", () => {
    renderCatalog("q=Rain");

    expect(
      screen.getByRole("link", { name: "查看《Before the Rain》专辑详情" }),
    ).toHaveAttribute("href", "/albums/before-the-rain");
  });

  it("does not show internal match reasons", () => {
    renderCatalog("q=Rain");

    expect(screen.queryByText(/title-partial|matchReason/i)).not.toBeInTheDocument();
  });

  it("does not add playback, comments, collections, or recommendations", () => {
    renderCatalog("q=Rain");

    for (const prohibitedText of ["播放", "评论", "收藏", "推荐"]) {
      expect(screen.queryByText(prohibitedText, { exact: false })).not.toBeInTheDocument();
    }
  });

  it("does not change results while the user is only typing", () => {
    renderCatalog("q=Rain");

    fireEvent.change(screen.getByLabelText("搜索专辑或艺术家"), {
      target: { value: "Mirror City" },
    });

    expect(screen.getByRole("heading", { name: "Before the Rain" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mirror City" })).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
