import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SearchPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("SearchPage", () => {
  it("renders the search route with shared site chrome", () => {
    const { container } = render(<SearchPage />);

    expect(container.querySelector(".site-header")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "搜索专辑", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("marks the separate search entry as the current page", () => {
    render(<SearchPage />);

    expect(screen.getByRole("link", { name: "搜索专辑和艺术家" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("states the local fictional data boundary", () => {
    render(<SearchPage />);

    expect(screen.getByText(/当前 18 张本地虚构专辑/)).toBeInTheDocument();
    expect(screen.getByText(/当前内容均为本地虚构数据/)).toBeInTheDocument();
    expect(screen.queryByText(/网易云|RYM|外部数据/)).not.toBeInTheDocument();
  });

  it("does not add user, playback, recommendation, or history features", () => {
    render(<SearchPage />);

    for (const prohibitedText of ["登录", "收藏", "播放", "推荐", "搜索历史"]) {
      expect(screen.queryByText(prohibitedText, { exact: false })).not.toBeInTheDocument();
    }
  });
});
