import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { publishedArtists } from "@/catalog/published-catalog";
import ArtistPage from "./page";
import { GlobalSearchProvider } from "@/components/search/global-search";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("not found"); }),
  usePathname: () => "/artists/example",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ArtistPage R16-2C integration", () => {
  it("keeps the complete chronology before collection context, personalization and continuous discovery", async () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const page = await ArtistPage({ params: Promise.resolve({ slug: artist.slug }) });
    const { container } = render(
      <PersonalStateProvider>
        <GlobalSearchProvider>{page}</GlobalSearchProvider>
      </PersonalStateProvider>,
    );
    const chronology = screen.getByRole("heading", { level: 2, name: "作品年表" });
    const collection = await screen.findByRole("heading", { level: 2, name: "这位艺人与我的专辑" });
    const continuation = screen.getByRole("heading", { level: 2, name: "从作品年表继续" });

    expect(chronology.compareDocumentPosition(collection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(collection.compareDocumentPosition(continuation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chronology.compareDocumentPosition(continuation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll(".r12-discography__release")).toHaveLength(artist.albumCount);
    expect(container.querySelectorAll(".r13-entity-discovery")).toHaveLength(1);
    expect(container.querySelectorAll(".r14-artist-journey")).toHaveLength(1);
    expect(container.querySelectorAll(".r16-artist-work-actions")).toHaveLength(artist.albumCount);
  });
});
