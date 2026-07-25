import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import Home from "./page";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

describe("physical archive home", () => {
  it("renders the complete static physical archive without old gallery UI", () => {
    const { container } = render(<PersonalStateProvider><Home /></PersonalStateProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "专辑发现" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /进入收藏目录/ })).toHaveAttribute("href", "/discover");
    expect(container.querySelector("[data-ring-cabinet]")).toBeInTheDocument();
    expect(container.querySelectorAll(".pa-cabinet-slot")).toHaveLength(6);
    expect(container.querySelectorAll(".pa-featured-scene")).toHaveLength(3);
    expect(container.querySelectorAll(".pa-featured-scene [data-position=active]")).toHaveLength(3);
    expect(container.querySelector(".home-gallery")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /三张唱片/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /一位创作者/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "最近收录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /十五条进入收藏柜/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /没有预设的起点/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/热度|氛围与特征|coming soon/i);
  });
});
