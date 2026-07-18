import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

describe("SiteHeader accessibility", () => {
  it("provides a skip link, labeled navigation, current-page state and settings entry", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "发现" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "关于" })).toHaveAttribute("href", "/settings");
  });
});
