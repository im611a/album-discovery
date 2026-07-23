import { fireEvent, render, screen } from "@testing-library/react";
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
    query = "genre=not-real&secondary=legacy-related&descriptor=legacy-descriptor";
    renderCatalog();
    expect(screen.getByLabelText("核心流派")).toHaveValue("");
    expect(screen.getByLabelText("相关流派")).toHaveValue("");
    expect(screen.getByLabelText("相关流派").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByLabelText("氛围与特征")).toHaveValue("");
    expect(screen.getByLabelText("氛围与特征").querySelectorAll("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(push).toHaveBeenCalledWith("/discover", { scroll: false });
  });

  it("keeps optional RYM filters visible without inventing empty choices", () => {
    renderCatalog();
    expect(screen.getByLabelText("相关流派")).toHaveDisplayValue("全部");
    expect(screen.getByLabelText("氛围与特征")).toHaveDisplayValue("全部");
    expect(screen.getByLabelText("相关流派").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByLabelText("氛围与特征").querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByLabelText("聆听场景（本站策展）")).toBeInTheDocument();
  });

  it("renders and submits only real optional taxonomy choices when data exists", () => {
    const update = vi.fn();
    render(<DiscoverFilterFields
      filterOptions={{
        coreGenres: ["pop"],
        relatedGenres: ["dream-pop"],
        descriptors: ["lush"],
        contexts: ["夜晚"],
        decades: ["2020s"],
      }}
      filters={{}}
      sort="recently-added"
      update={update}
    />);
    const related = screen.getByLabelText("相关流派");
    const descriptors = screen.getByLabelText("氛围与特征");
    expect(related.querySelector('option[value="dream-pop"]')).toBeInTheDocument();
    expect(descriptors.querySelector('option[value="lush"]')).toBeInTheDocument();
    fireEvent.change(related, { target: { value: "dream-pop" } });
    fireEvent.change(descriptors, { target: { value: "lush" } });
    expect(update).toHaveBeenCalledWith("secondary", "dream-pop");
    expect(update).toHaveBeenCalledWith("descriptor", "lush");
  });
});
