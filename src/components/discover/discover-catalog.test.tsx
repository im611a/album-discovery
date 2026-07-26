import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { DiscoverCatalog, DiscoverFilterFields } from "./discover-catalog";

const push = vi.fn();
let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query),
}));

describe("DiscoverCatalog URL state", () => {
  const renderCatalog = () => render(<PersonalStateProvider><DiscoverCatalog /></PersonalStateProvider>);
  const openFilters = () => fireEvent.click(screen.getByRole("button", { name: /筛选馆藏/ }));
  beforeEach(() => { push.mockClear(); query = ""; localStorage.clear(); });

  it("builds an encoded URL when a stable genre value changes", () => {
    renderCatalog();
    openFilters();
    fireEvent.change(screen.getByLabelText("核心流派"), { target: { value: "dream-pop" } });
    expect(push).toHaveBeenCalledWith("/discover?genre=dream-pop", { scroll: false });
  });

  it("restores valid filter and sort state from URL parameters", () => {
    query = "genre=ambient&sort=release-oldest&guide=1";
    renderCatalog();
    openFilters();
    expect(screen.getByLabelText("核心流派")).toHaveValue("ambient");
    expect(screen.getByLabelText("排序")).toHaveValue("release-oldest");
    expect(screen.getByLabelText("只看有完整导览")).toBeChecked();
  });

  it("ignores invalid filter values and can clear all URL state", () => {
    query = "genre=not-real&secondary=legacy-related&descriptor=legacy-descriptor";
    renderCatalog();
    openFilters();
    expect(screen.getByLabelText("核心流派")).toHaveValue("");
    expect(screen.getByLabelText("相关流派")).toHaveValue("");
    expect(screen.getByLabelText("相关流派").querySelectorAll("option").length).toBeGreaterThan(1);
    expect(screen.queryByLabelText("氛围与特征")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭筛选面板" }));
    fireEvent.click(screen.getByRole("button", { name: "清除全部" }));
    expect(push).toHaveBeenCalledWith("/discover", { scroll: false });
  });

  it("shows only verified related genres from the published snapshot", () => {
    renderCatalog();
    openFilters();
    expect(screen.getByLabelText("相关流派")).toHaveDisplayValue("全部");
    expect(screen.getByLabelText("相关流派")).toBeEnabled();
    expect(screen.getByLabelText("相关流派").querySelectorAll("option").length).toBeGreaterThan(1);
    expect(screen.queryByLabelText("氛围与特征")).not.toBeInTheDocument();
    expect(screen.getByLabelText("聆听场景")).toBeInTheDocument();
  });

  it("keeps the related genre control honest when a catalog has no verified choices", () => {
    render(<DiscoverFilterFields
      filterOptions={{
        coreGenres: ["pop"],
        relatedGenres: [],
        contexts: ["night"],
        decades: ["2020s"],
      }}
      filters={{}}
      sort="recently-added"
      update={vi.fn()}
    />);
    expect(screen.getByLabelText("相关流派")).toHaveDisplayValue("暂无已核验数据");
    expect(screen.getByLabelText("相关流派")).toBeDisabled();
    expect(screen.getByLabelText("相关流派").querySelectorAll("option")).toHaveLength(1);
  });

  it("renders and submits only real optional taxonomy choices when data exists", () => {
    const update = vi.fn();
    render(<DiscoverFilterFields
      filterOptions={{
        coreGenres: ["pop"],
        relatedGenres: ["dream-pop"],
        contexts: ["night"],
        decades: ["2020s"],
      }}
      filters={{}}
      sort="recently-added"
      update={update}
    />);
    const related = screen.getByLabelText("相关流派");
    expect(related.querySelector('option[value="dream-pop"]')).toBeInTheDocument();
    fireEvent.change(related, { target: { value: "dream-pop" } });
    expect(update).toHaveBeenCalledWith("secondary", "dream-pop");
  });

  it("renders only the first 48 results and resets page when a filter changes", () => {
    query = "page=2";
    const { container } = renderCatalog();
    openFilters();
    expect(container.querySelectorAll(".album-card")).toHaveLength(48);
    fireEvent.change(screen.getByLabelText("核心流派"), { target: { value: "pop" } });
    expect(push).toHaveBeenCalledWith("/discover?genre=pop", { scroll: false });
  });

  it("uses an accessible dialog and restores focus after Escape", async () => {
    renderCatalog();
    const trigger = screen.getByRole("button", { name: /筛选馆藏/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "筛选与排序" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "筛选与排序" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
