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

  it("offers honest display-name script categories before search and defaults to album count", () => {
    render(<ArtistDirectory />);
    const categories = screen.getByRole("navigation", { name: "按艺人名称文字系统缩小范围" });
    expect(within(categories).getAllByRole("link")).toHaveLength(6);
    expect(within(categories).getByText(/不代表艺人的国家、地区、国籍或语言/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "排序" })).toHaveValue("album-count");
    expect(screen.getByText(String(publishedArtists.length), { selector: "strong" })).toBeInTheDocument();
    expect(categories.compareDocumentPosition(screen.getByRole("search")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the selected category in search navigation", () => {
    navigation.query = "script=latin";
    render(<ArtistDirectory />);
    expect(screen.getByRole("link", { name: /拉丁字母/ })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索艺人" }), { target: { value: "The" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/^\/artists\?.*q=The.*script=latin|^\/artists\?.*script=latin.*q=The/), { scroll: false });
  });
});
