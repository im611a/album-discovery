import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialUserState } from "@/features/personal-state/schema";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { RecommendationCatalog } from "./recommendation-catalog";

describe("RecommendationCatalog feedback loop", () => {
  beforeEach(() => {
    localStorage.clear();
    const state = createInitialUserState();
    state.onboardingCompleted = true;
    state.taste = { ...state.taste, genres: ["ambient"], contexts: ["工作"] };
    localStorage.setItem("album-discovery:user-state:v1", JSON.stringify(state));
  });

  it("reorders recommendations immediately after not-for-me feedback", async () => {
    render(<PersonalStateProvider><RecommendationCatalog /></PersonalStateProvider>);
    const firstLink = (await screen.findAllByRole("link", { name: /专辑导览/ }))[0]!;
    const firstHref = firstLink.getAttribute("href");
    const card = firstLink.closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "不适合我" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: /专辑导览/ }).map((link) => link.getAttribute("href"))).not.toContain(firstHref));
  });
});
