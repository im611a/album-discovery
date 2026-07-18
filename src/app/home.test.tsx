import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import Home from "./page";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

describe("home product promise", () => {
  it("explains the core action and renders six real guided albums without unsupported promises", () => {
    render(<PersonalStateProvider><Home /></PersonalStateProvider>);
    expect(screen.getByRole("heading", { level: 1, name: /下一张值得/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始推荐" })).toHaveAttribute("href", "/for-you");
    expect(screen.getAllByRole("link", { name: /专辑导览/ })).toHaveLength(12);
    expect(document.body.textContent).not.toMatch(/热度|RYM 评分|别名搜索|coming soon/i);
  });
});
