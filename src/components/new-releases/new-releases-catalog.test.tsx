import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { albumsMock } from "@/data/albums.mock";
import { newReleaseSourceContextMock } from "@/data/new-releases.mock";

import { NewReleasesCatalog } from "./new-releases-catalog";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/new-releases",
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

function renderCatalog(query = "") {
  navigation.query = query;
  return render(
    <NewReleasesCatalog
      albums={albumsMock}
      sources={newReleaseSourceContextMock}
    />,
  );
}

describe("NewReleasesCatalog", () => {
  beforeEach(() => {
    navigation.query = "";
    navigation.push.mockReset();
  });

  it("renders local albums with ALL selected by default", () => {
    const { container } = renderCatalog();

    const allChannel = screen.getByRole("button", { name: /全部/ });
    expect(allChannel).toHaveAttribute("aria-pressed", "true");
    expect(within(allChannel).getByText("已选")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全部 · 18 张专辑" })).toBeInTheDocument();
    expect(container.querySelectorAll(".album-card")).toHaveLength(18);
  });

  it("restores channel and type state from the URL", () => {
    renderCatalog("channel=zh&type=ep");

    expect(screen.getByRole("button", { name: /华语新碟/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("发行类型")).toHaveValue("ep");
    expect(
      screen.getByRole("heading", { name: "华语新碟 · 1 张专辑" }),
    ).toBeInTheDocument();
  });

  it("writes stable channel values to the URL", () => {
    renderCatalog();

    fireEvent.click(screen.getByRole("button", { name: "日本新碟" }));

    expect(navigation.push).toHaveBeenCalledWith("/new-releases?channel=jp", {
      scroll: false,
    });
  });

  it("combines channel and type URL parameters", () => {
    renderCatalog("channel=ea");

    fireEvent.change(screen.getByLabelText("发行类型"), {
      target: { value: "mixtape" },
    });

    expect(navigation.push).toHaveBeenCalledWith(
      "/new-releases?channel=ea&type=mixtape",
      { scroll: false },
    );
  });

  it("shows a useful empty state with reset actions", () => {
    renderCatalog("channel=zh&type=mixtape");

    expect(
      screen.getByRole("heading", { name: "当前条件下没有新发行专辑" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清除类型筛选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看全部频道" })).toBeInTheDocument();
  });

  it("explains the limited meaning of market channels", () => {
    renderCatalog();

    const note = screen.getByText(/市场频道是发现来源/);
    expect(note).toHaveTextContent(/不代表.*国籍/);
    expect(note).toHaveTextContent(/语言/);
    expect(note).toHaveTextContent(/法域/);
    expect(note).toHaveTextContent(/真实地区/);
  });

  it("does not introduce popularity or domestic and foreign categories", () => {
    renderCatalog();

    for (const prohibitedText of ["热度", "播放量", "国内专辑", "国外专辑"]) {
      expect(screen.queryByText(prohibitedText, { exact: false })).not.toBeInTheDocument();
    }
  });
});
