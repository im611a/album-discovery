import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

describe("SiteHeader accessibility", () => {
  it("provides a skip link, labeled navigation, current-page state and settings entry", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "发现" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "打开菜单" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the compact menu and returns focus when Escape closes it", () => {
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: "打开菜单" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "关闭菜单" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "打开菜单" })).toHaveFocus();
  });
});
