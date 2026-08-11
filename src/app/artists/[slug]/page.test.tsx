import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { publishedArtists } from "@/catalog/published-catalog";
import ArtistPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("not found"); }),
  usePathname: () => "/artists/example",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ArtistPage R13-3D integration", () => {
  it("keeps the complete chronology before the visible continuous-discovery surface", async () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const page = await ArtistPage({ params: Promise.resolve({ slug: artist.slug }) });
    const { container } = render(page);
    const chronology = screen.getByRole("heading", { level: 2, name: "作品年表" });
    const continuation = screen.getByRole("heading", { level: 2, name: "从作品年表继续" });

    expect(chronology.compareDocumentPosition(continuation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll(".r12-discography__release")).toHaveLength(artist.albumCount);
    expect(container.querySelectorAll(".r13-entity-discovery")).toHaveLength(1);
  });
});
