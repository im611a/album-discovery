import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { AlbumActions } from "./album-actions";

describe("AlbumActions", () => {
  it("exposes all five product states and updates a pressed state", async () => {
    render(<PersonalStateProvider><AlbumActions album={catalogAlbums[0]} /></PersonalStateProvider>);
    const save = await screen.findByRole("button", { name: "想听" });
    expect(screen.getByRole("button", { name: "喜欢" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "听过" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不适合我" })).toBeInTheDocument();
    fireEvent.click(save);
    expect(await screen.findByRole("button", { name: "已想听" })).toHaveAttribute("aria-pressed", "true");
  });
  it("keeps compact cards focused on three primary actions", async () => {
    render(<PersonalStateProvider><AlbumActions album={catalogAlbums[0]} compact /></PersonalStateProvider>);
    await screen.findByRole("button", { name: "想听" });
    expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "听过" })).not.toBeInTheDocument();
  });
  it("keeps the explicit like feedback state synchronized", async () => {
    render(<PersonalStateProvider><AlbumActions album={catalogAlbums[0]} /></PersonalStateProvider>);
    const favorite = await screen.findByRole("button", { name: "喜欢" });
    fireEvent.click(favorite);
    expect(await screen.findByRole("button", { name: "已喜欢" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "已喜欢" }));
    expect(await screen.findByRole("button", { name: "喜欢" })).toHaveAttribute("aria-pressed", "false");
  });
  it("keeps collection independent from recommendation-like feedback", async () => {
    render(<PersonalStateProvider><AlbumActions album={catalogAlbums[0]} /></PersonalStateProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "收藏" }));
    expect(await screen.findByRole("button", { name: "已收藏" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "喜欢" })).toHaveAttribute("aria-pressed", "false");
  });
});
