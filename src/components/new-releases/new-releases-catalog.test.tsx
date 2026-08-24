import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { NewReleasesCatalog } from "./new-releases-catalog";

const push = vi.fn();
let query = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(query) }));

describe("NewReleasesCatalog URL view", { timeout: 30_000 }, () => {
  beforeEach(() => { query = ""; push.mockClear(); localStorage.clear(); });
  it("defaults to recently added and switches with a recoverable URL", () => {
    render(<PersonalStateProvider><NewReleasesCatalog /></PersonalStateProvider>);
    expect(screen.getByRole("tab", { name: "最近收录" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "近期发行" }));
    expect(push).toHaveBeenCalledWith("/new-releases?view=released", { scroll: false });
  });
  it("restores the released view and rejects unsupported values", () => {
    query = "view=released";
    const { unmount } = render(<PersonalStateProvider><NewReleasesCatalog /></PersonalStateProvider>);
    expect(screen.getByRole("tab", { name: "近期发行" })).toHaveAttribute("aria-selected", "true");
    unmount();
    query = "view=unknown";
    render(<PersonalStateProvider><NewReleasesCatalog /></PersonalStateProvider>);
    expect(screen.getByRole("tab", { name: "最近收录" })).toHaveAttribute("aria-selected", "true");
  });
  it("restores a NetEase market channel and keeps its provenance wording precise", () => {
    query = "channel=zh";
    render(<PersonalStateProvider><NewReleasesCatalog /></PersonalStateProvider>);
    expect(screen.getByRole("tab", { name: "华语新碟" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("频道只记录专辑从哪个新发行列表被发现，不代表国籍、地区或语言。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "全部频道" }));
    expect(push).toHaveBeenCalledWith("/new-releases?channel=all", { scroll: false });
  });
});
