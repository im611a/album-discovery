import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

vi.mock("next/navigation", () => ({ usePathname: () => "/albums/missing" }));

describe("friendly not-found page", () => {
  it("offers working returns to discover and home without fake actions", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "没有找到这个页面" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回发现专辑" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "浏览艺人" })).toHaveAttribute("href", "/artists");
  });
});
