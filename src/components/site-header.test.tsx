import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("keeps three primary destinations and exposes search separately", () => {
    render(<SiteHeader activePath="/" />);

    const navigation = screen.getByRole("navigation", { name: "主导航" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(3);
    expect(within(navigation).getByRole("link", { name: "首页" })).toBeInTheDocument();
    expect(
      within(navigation).getByRole("link", { name: "发现专辑" }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole("link", { name: "新发行" }),
    ).toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: /搜索/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "搜索专辑和艺术家" })).toBeInTheDocument();
  });
});
