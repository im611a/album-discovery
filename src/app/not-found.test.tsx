import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";
import { GlobalSearchProvider } from "@/components/search/global-search";

vi.mock("next/navigation", () => ({ usePathname: () => "/albums/missing" }));

describe("friendly not-found page", () => {
  it("offers working returns to discover and home without fake actions", () => {
    render(<GlobalSearchProvider><NotFound /></GlobalSearchProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "未找到该档案" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "进入发现" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("button", { name: "进入搜索" })).toBeInTheDocument();
  });
});
