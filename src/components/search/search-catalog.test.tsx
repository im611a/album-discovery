import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { SearchCatalog } from "./search-catalog";

const push = vi.fn();
let query = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(query ? { q: query } : {}) }));

describe("SearchCatalog", () => {
  beforeEach(() => { query = ""; push.mockClear(); localStorage.clear(); });
  it("shows an initial state without a query", () => {
    render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    expect(screen.getByText("从一个名字或感觉开始")).toBeInTheDocument();
  });
  it("submits through a semantic form with encoded URLSearchParams", () => {
    render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    fireEvent.change(screen.getByLabelText("搜索专辑目录"), { target: { value: "纸 & + 月" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=%E7%BA%B8+%26+%2B+%E6%9C%88", { scroll: false });
  });
  it("finds Chinese artists and highlights a visible hit", () => {
    query = "王菲";
    const { container } = render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    expect(screen.getByText(/找到/)).toBeInTheDocument();
    expect(container.querySelector("mark")?.textContent).toBe("王菲");
  });
});
