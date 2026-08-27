import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { RecommendationCatalog } from "./recommendation-catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("RecommendationCatalog product simplification", () => {
  beforeEach(() => {
    localStorage.clear();
    const state = createInitialUserState();
    state.onboardingCompleted = true;
    state.taste = { ...state.taste, genres: ["ambient"], contexts: ["工作"] };
    localStorage.setItem("album-discovery:user-state:v1", JSON.stringify(state));
  });

  it("presents one primary choice, rotates it on demand and keeps taste controls secondary", async () => {
    render(<PersonalStateProvider><RecommendationCatalog /></PersonalStateProvider>);
    const primary = (await screen.findAllByRole("link", { name: /专辑导览/ }))[0]!.closest("article")!;
    const firstHref = within(primary).getByRole("link", { name: "查看专辑" }).getAttribute("href");
    expect(screen.queryByRole("heading", { name: "调整口味" })).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-for-you-card="alternative"]')).toHaveLength(5);

    fireEvent.click(within(primary).getByRole("button", { name: "换一张" }));
    expect(document.querySelector('[data-for-you-card="primary"] a[href]')?.getAttribute("href")).not.toBe(firstHref);

    fireEvent.click(screen.getByRole("button", { name: "调整口味" }));
    expect(screen.getAllByRole("heading", { name: "调整口味" })).toHaveLength(2);
    expect(screen.getByRole("group", { name: /常见聆听场景/ })).toBeInTheDocument();
  });

  it("reduces cold start to the minimum truthful genre choice", async () => {
    localStorage.setItem("album-discovery:user-state:v1", JSON.stringify(createInitialUserState()));
    render(<PersonalStateProvider><RecommendationCatalog /></PersonalStateProvider>);

    expect(await screen.findByRole("heading", { name: "先选 2–5 个你常听的流派" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /核心流派偏好/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /常见聆听场景/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /推荐取向/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /种子专辑/ })).not.toBeInTheDocument();
  });
});
