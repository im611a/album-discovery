import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { SearchCatalog } from "./search-catalog";

const push = vi.fn();
let query = "";
let page = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams({ ...(query ? { q: query } : {}), ...(page ? { page } : {}) }) }));

describe("SearchCatalog", () => {
  beforeEach(() => { query = ""; page = ""; push.mockClear(); localStorage.clear(); });
  it("shows an initial state without a query", () => {
    render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    expect(screen.getByText("从一个名字开始")).toBeInTheDocument();
  });
  it("submits through a semantic form with encoded URLSearchParams", () => {
    render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    fireEvent.change(screen.getByLabelText("搜索专辑目录"), { target: { value: "纸 & + 月" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=%E7%BA%B8+%26+%2B+%E6%9C%88", { scroll: false });
  });
  it("finds Chinese artists and renders editorial result rows", () => {
    query = "王菲";
    const { container } = render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    expect(screen.getByText(/找到/)).toBeInTheDocument();
    expect(container.querySelector(".artist-editorial-row")).toBeInTheDocument();
    expect(container.querySelector(".compact-album-row")).toBeInTheDocument();
    expect(container.querySelector<HTMLAnchorElement>(".artist-editorial-row__action")?.href).toContain("sfrom=search");
    expect(container.querySelector<HTMLAnchorElement>(".compact-album-row__cover")?.href).toContain("sq=%E7%8E%8B%E8%8F%B2");
  });
  it("resets pagination when a new query is submitted", () => {
    query = "专辑";
    page = "2";
    render(<PersonalStateProvider><SearchCatalog /></PersonalStateProvider>);
    fireEvent.change(screen.getByLabelText("搜索专辑目录"), { target: { value: "王菲" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=%E7%8E%8B%E8%8F%B2", { scroll: false });
  });
});
