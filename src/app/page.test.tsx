import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the four required discovery sections", () => {
    render(<Home />);

    for (const heading of ["近期发行", "高分专辑", "最近收录", "随机发现"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("renders six albums in each home catalog grid", () => {
    render(<Home />);

    for (const heading of ["近期发行", "高分专辑", "最近收录"]) {
      const section = screen.getByRole("region", { name: heading });

      expect(within(section).getAllByRole("article")).toHaveLength(6);
      expect(section.querySelector(".album-grid--home")).toBeInTheDocument();
    }
  });

  it("changes the deterministic random discovery album", () => {
    render(<Home />);

    const section = screen.getByRole("region", { name: "随机发现" });
    const initialAlbum = within(section).getByRole("heading", { level: 3 }).textContent;

    fireEvent.click(within(section).getByRole("button", { name: "换一张" }));

    expect(within(section).getByRole("heading", { level: 3 })).not.toHaveTextContent(
      initialAlbum ?? "",
    );
  });
});
