import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishedArtists } from "@/catalog/published-catalog";

import { ArtistDirectory } from "./artist-directory";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

describe("ArtistDirectory public orientation", () => {
  beforeEach(() => {
    navigation.query = "";
    navigation.push.mockReset();
  });

  it("offers deterministic musical genre categories before search and defaults to album count", () => {
    render(<ArtistDirectory />);
    const categories = screen.getByRole("navigation", { name: "按艺人主流派缩小范围" });
    expect(within(categories).getAllByRole("link")).toHaveLength(10);
    expect(within(categories).getByText(/不使用姓名或地区推断/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "排序" })).toHaveValue("album-count");
    expect(screen.getByText(String(publishedArtists.length), { selector: "strong" })).toBeInTheDocument();
    expect(categories.compareDocumentPosition(screen.getByRole("search")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the selected genre group in search navigation", () => {
    navigation.query = "genre=rock";
    render(<ArtistDirectory />);
    const categories = screen.getByRole("navigation", { name: "按艺人主流派缩小范围" });
    expect(within(categories).getByRole("link", { name: /摇滚/ })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索艺人" }), { target: { value: "The" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/^\/artists\?.*q=The.*genre=rock|^\/artists\?.*genre=rock.*q=The/), { scroll: false });
  });
});
