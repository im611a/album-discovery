import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("shows a concise album not-found state with safe exits", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "没有找到这张专辑" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回发现专辑" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
