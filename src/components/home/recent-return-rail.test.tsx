import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { createInitialUserState } from "@/features/personal-state/schema";
import { RecentReturnRail } from "./recent-return-rail";

let mocked = { state: createInitialUserState(), hydrated: true, storageAvailable: true };
vi.mock("@/features/personal-state/personal-state-provider", () => ({ usePersonalState: () => mocked }));

describe("R17 Home recent return rail", () => {
  beforeEach(() => { mocked = { state: createInitialUserState(), hydrated: true, storageAvailable: true }; });

  it("shows a deliberate empty journey", () => {
    render(<RecentReturnRail />);
    expect(screen.getByRole("heading", { name: "最近查看" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /浏览专辑档案/ })).toHaveAttribute("href", "/discover");
  });

  it("shows bounded truthful album links in recent order", () => {
    mocked = { ...mocked, state: { ...mocked.state, recentAlbumIds: catalogAlbums.slice(0, 8).map((album) => album.id) } };
    render(<RecentReturnRail />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("link", { name: /最近查看第 1 张/ })).toHaveAttribute("href", expect.stringContaining("lview=recent"));
    expect(screen.getByText("浏览不等于收听。", { exact: false })).toBeInTheDocument();
  });

  it("communicates storage unavailability without losing session content", () => {
    mocked = { ...mocked, storageAvailable: false, state: { ...mocked.state, recentAlbumIds: [catalogAlbums[0].id] } };
    render(<RecentReturnRail />);
    expect(screen.getByText(/无法确认持久保存/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /最近查看第 1 张/ })).toBeInTheDocument();
  });
});
