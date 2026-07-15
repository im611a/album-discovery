import { fireEvent, render, screen } from "@testing-library/react";
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

  it("removes one active filter without clearing the others", () => {
    renderCatalog("decade=2010s&type=ep");

    fireEvent.click(
      screen.getByRole("button", { name: "移除筛选：发行类型：EP" }),
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
