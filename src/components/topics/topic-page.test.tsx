import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getTopic } from "@/catalog/topics";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { TopicPage } from "./topic-page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/genres/core/alternative-rock",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("TopicPage R13-3D integration", () => {
  it("keeps the factual, filterable catalog before one distinct discovery entry", () => {
    const topic = getTopic("core", "alternative-rock")!;
    const { container } = render(
      <PersonalStateProvider>
        <TopicPage topic={topic} pathname="/genres/core/alternative-rock" />
      </PersonalStateProvider>,
    );
    const catalog = container.querySelector(".album-grid")!;
    const continuation = screen.getByRole("heading", { level: 2, name: "从这一专题继续" });

    expect(catalog.compareDocumentPosition(continuation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "随机发现一张" })).toBeInTheDocument();
    expect(container.querySelectorAll(".r13-entity-discovery")).toHaveLength(1);
  });
});
