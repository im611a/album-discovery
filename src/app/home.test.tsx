import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import Home from "./page";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

describe("home product promise", () => {
  it("explains the core action and renders the evidence-driven editorial sequence", () => {
    const { container } = render(<PersonalStateProvider><Home /></PersonalStateProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "专辑发现" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看本机推荐 →" })).toHaveAttribute("href", "/for-you");
    expect(container.querySelectorAll(".editorial-canvas .editorial-album-object")).toHaveLength(9);
    expect(screen.getByRole("heading", { level: 2, name: /三张专辑/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /一位创作者/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "最近收录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /十五条进入目录/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /没有预设的起点/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/热度|别名搜索|coming soon/i);
  });
});
