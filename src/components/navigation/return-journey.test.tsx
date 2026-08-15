import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnContextLink, ReturnJourneyAffordance } from "./return-journey";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));

describe("R15 return journey UI", () => {
  beforeEach(() => { query = ""; });

  it("renders a truthful Library return and preserves context on continuation", () => {
    query = "entry=album&lfrom=library&lview=favorite&lq=ambient&lsort=title";
    render(<><ReturnJourneyAffordance /><ReturnContextLink href="/artists/example?entry=album">继续</ReturnContextLink></>);
    expect(screen.getByRole("link", { name: /返回我的专辑/ })).toHaveAttribute("href", "/library?view=favorite&q=ambient&sort=title");
    expect(screen.getByRole("link", { name: "继续" })).toHaveAttribute("href", expect.stringContaining("lfrom=library"));
  });

  it("renders Search return but hides ambiguous provenance", () => {
    query = "sfrom=search&sq=%E7%8E%8B%E8%8F%B2&spage=2";
    const { rerender } = render(<ReturnJourneyAffordance />);
    expect(screen.getByRole("link", { name: /返回搜索结果/ })).toHaveAttribute("href", "/search?q=%E7%8E%8B%E8%8F%B2&page=2");
    query = "sfrom=search&sq=test&lfrom=library";
    rerender(<ReturnJourneyAffordance />);
    expect(screen.queryByRole("link", { name: /返回/ })).not.toBeInTheDocument();
  });

  it("renders truthful Home, Explore and Artist returns from existing provenance", () => {
    query = "pfrom=home";
    const { rerender } = render(<ReturnJourneyAffordance />);
    expect(screen.getByRole("link", { name: /返回首页/ })).toHaveAttribute("href", "/");
    query = "entry=explore";
    rerender(<ReturnJourneyAffordance />);
    expect(screen.getByRole("link", { name: /返回探索/ })).toHaveAttribute("href", "/explore");
  });
});
