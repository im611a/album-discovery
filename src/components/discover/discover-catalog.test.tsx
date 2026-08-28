import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDiscoverOptions } from "@/catalog/queries";
import { catalogAlbums, getTaxonomyLabel } from "@/catalog/published-catalog";
import type { CatalogQueryState } from "@/catalog/catalog-view-model";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { DiscoverCatalog, DiscoverFilterFields } from "./discover-catalog";

const push = vi.fn();
let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query),
}));

const options = buildDiscoverOptions(catalogAlbums);
const emptyQuery: CatalogQueryState = {
  query: "",
  filters: {
    coreGenre: null,
    relatedGenre: null,
    context: null,
    decade: null,
    releaseType: null,
    editorialOnly: false,
    rymRatedOnly: false,
  },
  userStatus: null,
  sort: "recently-added",
};

describe("DiscoverCatalog URL state", () => {
  const renderCatalog = () => render(<PersonalStateProvider><DiscoverCatalog /></PersonalStateProvider>);
  const openAdvancedFilters = () => {
    const trigger = screen.getByRole("button", { name: /更多筛选/ });
    if (trigger.getAttribute("aria-expanded") === "false") fireEvent.click(trigger);
    return trigger;
  };

  beforeEach(() => {
    push.mockClear();
    query = "";
    localStorage.clear();
  });

  it("keeps the complete catalog filter foundation in the document flow", () => {
    renderCatalog();
    expect(screen.getByRole("heading", { name: `${catalogAlbums.length} 张专辑` })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: /更多筛选/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("高级目录筛选")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    for (const label of ["核心流派", "相关流派", "聆听场景", "年代", "发行类型", "本机状态", "排序"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("更多筛选")).toBeInTheDocument();
    expect(screen.getByLabelText("年代").closest(".filter-grid--primary")).toBeInTheDocument();
    expect(screen.getByLabelText("排序").querySelectorAll("option")).toHaveLength(5);
    expect(screen.getByLabelText("排序")).toHaveTextContent("随机发现");
    expect(screen.getByLabelText("排序")).not.toHaveTextContent("标题");
    expect(screen.getByLabelText("排序")).toHaveTextContent("RYM评分：高→低");
    expect(screen.getByRole("checkbox", { name: /仅看有 RYM 评分/ })).toBeInTheDocument();
  });

  it("builds an encoded URL when a stable genre value changes", () => {
    renderCatalog();
    const genre = options.coreGenres[0];
    fireEvent.change(screen.getByLabelText("核心流派"), { target: { value: genre } });
    expect(push).toHaveBeenCalledWith(`/discover?core=${encodeURIComponent(genre)}`, { scroll: false });
  });

  it("restores valid search, filter, status, and sort state from URL parameters", () => {
    const core = options.coreGenres[0];
    query = `q=${encodeURIComponent("陈珊妮")}&core=${encodeURIComponent(core)}&status=liked&sort=release-oldest&editorial=1`;
    renderCatalog();
    expect(screen.getByLabelText("搜索专辑或艺人")).toHaveValue("陈珊妮");
    expect(screen.getByLabelText("核心流派")).toHaveValue(core);
    expect(screen.getByLabelText("本机状态")).toHaveValue("liked");
    expect(screen.getByLabelText("排序")).toHaveValue("release-oldest");
    expect(screen.getByLabelText("只看有完整导览")).toBeChecked();
    expect(screen.getByRole("button", { name: /更多筛选 · 已启用 2 项/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores invalid values and clears the URL state", () => {
    query = "core=not-real&related=not-real&status=unknown";
    renderCatalog();
    expect(screen.getByLabelText("核心流派")).toHaveValue("");
    openAdvancedFilters();
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("本机状态")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "清除全部" }));
    expect(push).toHaveBeenCalledWith("/discover", { scroll: false });
  });

  it("submits an album or artist query through URLSearchParams", () => {
    renderCatalog();
    fireEvent.change(screen.getByLabelText("搜索专辑或艺人"), { target: { value: "  王菲 & Co  " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/discover?q=%E7%8E%8B%E8%8F%B2+%26+Co", { scroll: false });
  });

  it("renders only the first 48 catalog results", () => {
    const { container } = renderCatalog();
    expect(screen.getByRole("heading", { name: `${catalogAlbums.length} 张专辑` })).toBeInTheDocument();
    expect(screen.getByText(/当前显示/)).toHaveTextContent("当前显示 48 张");
    expect(container.querySelectorAll(".album-card")).toHaveLength(48);
  });

  it("explains incomplete RYM coverage and preserves the rated-only URL state", () => {
    query = "sort=rym-rating-desc&rym=rated";
    renderCatalog();
    expect(screen.getByLabelText("排序")).toHaveValue("rym-rating-desc");
    expect(screen.getByRole("checkbox", { name: /仅看有 RYM 评分/ })).toBeChecked();
    expect(screen.getByText(/不将缺失值视为 0/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "13 张专辑" })).toBeInTheDocument();
  });

  it("keeps optional taxonomy controls honest when verified choices are absent", () => {
    const updateFilter = vi.fn();
    render(<DiscoverFilterFields
      query={emptyQuery}
      updateFilter={updateFilter}
      updateStatus={vi.fn()}
      updateSort={vi.fn()}
    />);
    openAdvancedFilters();
    expect(screen.getByLabelText("搜索相关流派")).toHaveValue("");
    expect(screen.getByLabelText("相关流派").querySelectorAll("button")).toHaveLength(options.relatedGenres.length + 1);
    if (options.relatedGenres[0]) {
      fireEvent.click(screen.getByRole("button", { name: getTaxonomyLabel(options.relatedGenres[0]) }));
      expect(updateFilter).toHaveBeenCalledWith("relatedGenre", options.relatedGenres[0]);
    }
  });

  it("searches only the canonical related-genre choices without changing catalog data", () => {
    render(<DiscoverFilterFields query={emptyQuery} updateFilter={vi.fn()} updateStatus={vi.fn()} updateSort={vi.fn()} />);
    openAdvancedFilters();
    const target = options.relatedGenres[0]!;
    fireEvent.change(screen.getByLabelText("搜索相关流派"), { target: { value: target } });
    expect(screen.getByRole("button", { name: getTaxonomyLabel(target) })).toBeInTheDocument();
    expect(screen.getByLabelText("相关流派").querySelectorAll("button")).toHaveLength(2);
  });
});
