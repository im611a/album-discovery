import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { albumsMock } from "@/data/albums.mock";

import { DiscoverCatalog } from "./discover-catalog";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/discover",
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

function renderCatalog(query = "") {
  navigation.query = query;
  return render(<DiscoverCatalog albums={albumsMock} />);
}

describe("DiscoverCatalog", () => {
  beforeEach(() => {
    navigation.query = "";
    navigation.push.mockReset();
  });

  it("renders the local album results", () => {
    renderCatalog();

    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "纸上月光" })).toBeInTheDocument();
  });

  it("restores a decade filter from the URL", () => {
    renderCatalog("decade=2010s");

    expect(screen.getByLabelText("年代")).toHaveValue("2010s");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("writes filter changes to stable URL parameters", () => {
    renderCatalog();

    fireEvent.change(screen.getByLabelText("发行类型"), {
      target: { value: "ep" },
    });

    expect(navigation.push).toHaveBeenCalledWith("/discover?type=ep", {
      scroll: false,
    });
  });

  it("keeps translated genre labels separate from stable URL values", () => {
    renderCatalog();

    const primaryGenre = screen.getByRole("combobox", { name: "主流派" });
    const translatedOption = within(primaryGenre).getByRole("option", {
      name: "另类节奏布鲁斯",
    });

    expect(translatedOption).toHaveValue("alternative-r-b");
    fireEvent.change(primaryGenre, { target: { value: "alternative-r-b" } });

    expect(navigation.push).toHaveBeenCalledWith(
      "/discover?primaryGenre=alternative-r-b",
      { scroll: false },
    );
  });

  it("uses the same translated genre label in filters and album cards", () => {
    renderCatalog();

    const primaryGenre = screen.getByRole("combobox", { name: "主流派" });
    expect(
      within(primaryGenre).getByRole("option", { name: "另类节奏布鲁斯" }),
    ).toBeInTheDocument();

    const album = screen.getByRole("heading", { name: "Mirror City" }).closest("article");
    expect(album).not.toBeNull();
    expect(within(album as HTMLElement).getByText("另类节奏布鲁斯")).toBeInTheDocument();
  });

  it("shows the active filter count and sort name in the mobile summary", () => {
    renderCatalog("decade=2010s&type=ep&sort=score");

    const summary = screen.getByText("2 项筛选").closest("summary");
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText("筛选与排序")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("RYM 评分最高")).toBeInTheDocument();
  });

  it("keeps active filters and clear actions outside the collapsed primary filters", () => {
    const { container } = renderCatalog("decade=2010s&type=ep");

    const primaryFilters = container.querySelector(".primary-filters");
    const clearButton = screen.getByRole("button", { name: "清除全部" });

    expect(primaryFilters).not.toHaveAttribute("open");
    expect(primaryFilters).not.toContainElement(clearButton);
    expect(screen.getByLabelText("当前筛选条件")).toBeInTheDocument();
  });

  it("keeps the primary controls expanded for the desktop layout", () => {
    const { container } = renderCatalog();

    expect(
      container.querySelector(".primary-filters + .primary-filters__content"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("年代")).toBeInTheDocument();
    expect(screen.getByLabelText("排序")).toBeInTheDocument();
  });

  it("does not expose English taxonomy structure labels in the interface", () => {
    renderCatalog();

    for (const label of ["Primary Genre", "Secondary Genre", "Descriptor"]) {
      expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
    }

    expect(screen.getByRole("combobox", { name: "主流派" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "次要流派" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "描述标签" })).toBeInTheDocument();
  });

  it("removes one active filter without clearing the others", () => {
    renderCatalog("decade=2010s&type=ep");

    fireEvent.click(
      screen.getByRole("button", {
        name: "移除筛选：发行类型：迷你专辑（EP）",
      }),
    );

    expect(navigation.push).toHaveBeenCalledWith("/discover?decade=2010s", {
      scroll: false,
    });
  });

  it("clears all filters and sorting back to the default URL", () => {
    renderCatalog("decade=2010s&type=ep&sort=score");

    fireEvent.click(screen.getByRole("button", { name: "清除全部" }));

    expect(navigation.push).toHaveBeenCalledWith("/discover", { scroll: false });
  });

  it("renders an empty state and a clear action", () => {
    renderCatalog("decade=2000s");

    expect(
      screen.getByRole("heading", { name: "没有找到符合条件的专辑" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清除筛选" })).toBeInTheDocument();
  });

  it("shows default results for invalid URL parameters", () => {
    renderCatalog("decade=future&type=single&sort=popular");

    expect(screen.getByLabelText("年代")).toHaveValue("all");
    expect(screen.getByLabelText("发行类型")).toHaveValue("all");
    expect(screen.getByText("18")).toBeInTheDocument();
  });
});
