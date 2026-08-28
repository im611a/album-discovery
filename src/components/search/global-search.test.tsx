import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearchProvider, GlobalSearchTrigger } from "./global-search";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }));

describe("GlobalSearch", () => {
  beforeEach(() => push.mockReset());

  it("opens from the visible trigger and returns focus after Escape", async () => {
    render(<GlobalSearchProvider><GlobalSearchTrigger>搜索</GlobalSearchTrigger></GlobalSearchProvider>);
    const trigger = screen.getByRole("button", { name: "搜索" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "全局搜索" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens with Ctrl+K and groups local album and artist results", () => {
    render(<GlobalSearchProvider><main>页面</main></GlobalSearchProvider>);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByRole("searchbox", { name: "全局搜索" }), { target: { value: "Madvillain" } });
    expect(screen.getByRole("heading", { name: /^专辑/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^艺人/ })).toBeInTheDocument();
    expect(screen.getByText("Madvillainy")).toBeInTheDocument();
  });

  it("supports Arrow keys and Enter without a runtime search service", () => {
    render(<GlobalSearchProvider><GlobalSearchTrigger /></GlobalSearchProvider>);
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    const input = screen.getByRole("searchbox", { name: "全局搜索" });
    fireEvent.change(input, { target: { value: "Radiohead" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/albums\//));
  });
});
