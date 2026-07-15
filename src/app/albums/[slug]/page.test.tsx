import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AlbumDetailPage, {
  generateMetadata,
  generateStaticParams,
} from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("AlbumDetailPage", () => {
  it("generates all eighteen static album detail slugs", () => {
    const params = generateStaticParams();

    expect(params).toHaveLength(18);
    expect(new Set(params.map((entry) => entry.slug)).size).toBe(18);
    expect(params).toContainEqual({ slug: "paper-moonlight" });
  });

  it("renders a known album with site chrome and breadcrumb navigation", async () => {
    const page = await AlbumDetailPage({
      params: Promise.resolve({ slug: "paper-moonlight" }),
    });
    render(page);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "纸上月光" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "面包屑" })).toHaveTextContent(
      "发现专辑/纸上月光",
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("generates metadata from the fictional album and artist names", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "before-the-rain" }),
    });

    expect(metadata.title).toBe("Before the Rain · June Atlas · 专辑发现");
    expect(metadata.description).toContain("本地虚构专辑详情原型");
  });

  it("uses notFound for an unknown slug", async () => {
    await expect(
      AlbumDetailPage({ params: Promise.resolve({ slug: "unknown-album" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
