import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { DiscoverCatalog } from "./discover-catalog";

const push = vi.fn();
let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query),
}));

describe("DiscoverCatalog URL state", () => {
  const renderCatalog = () => render(<PersonalStateProvider><DiscoverCatalog /></PersonalStateProvider>);
  beforeEach(() => { push.mockClear(); query = ""; localStorage.clear(); });

  it("builds an encoded URL when a stable genre value changes", () => {
    renderCatalog();
    fireEvent.change(screen.getByLabelText("核心流派"), { target: { value: "dream-pop" } });
    expect(push).toHaveBeenCalledWith("/discover?genre=dream-pop", { scroll: false });
  });

  it("restores valid filter and sort state from URL parameters", () => {
    query = "genre=ambient&sort=release-oldest&guide=1";
    renderCatalog();
    expect(screen.getByLabelText("核心流派")).toHaveValue("ambient");
    expect(screen.getByLabelText("排序")).toHaveValue("release-oldest");
    expect(screen.getByLabelText("只看有完整导览")).toBeChecked();
  });

  it("ignores invalid filter values and can clear all URL state", () => {
    query = "genre=not-real";
    renderCatalog();
    expect(screen.getByLabelText("核心流派")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(push).toHaveBeenCalledWith("/discover", { scroll: false });
  });
});
