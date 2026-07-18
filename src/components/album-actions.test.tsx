import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { AlbumActions } from "./album-actions";

describe("AlbumActions", () => {
  it("exposes all four product states and updates a pressed state", async () => {
    render(<PersonalStateProvider><AlbumActions album={catalogAlbums[0]} /></PersonalStateProvider>);
    const save = await screen.findByRole("button", { name: "想听" });
    expect(screen.getByRole("button", { name: "喜欢" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "听过" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不适合我" })).toBeInTheDocument();
    fireEvent.click(save);
    expect(await screen.findByRole("button", { name: "已想听" })).toHaveAttribute("aria-pressed", "true");
  });
  it("keeps compact cards focused on two primary actions", async () => {
    render(<PersonalStateProvider><AlbumActions album={catalogAlbums[0]} compact /></PersonalStateProvider>);
    await screen.findByRole("button", { name: "想听" });
    expect(screen.queryByRole("button", { name: "听过" })).not.toBeInTheDocument();
  });
});
