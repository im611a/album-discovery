import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";
import { GlobalSearchProvider } from "./search/global-search";

vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

describe("SiteHeader accessibility", () => {
  it("provides a skip link, labeled navigation, current-page state and settings entry", () => {
    render(<GlobalSearchProvider><SiteHeader /></GlobalSearchProvider>);
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "目录" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("发现")).toBeInTheDocument();
    expect(screen.getByText("个人")).toBeInTheDocument();
    expect(screen.getByText("档案")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "年代" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开菜单" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the compact menu and returns focus when Escape closes it", () => {
    render(<GlobalSearchProvider><SiteHeader /></GlobalSearchProvider>);
    const button = screen.getByRole("button", { name: "打开菜单" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "关闭菜单" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "打开菜单" })).toHaveFocus();
  });
});
