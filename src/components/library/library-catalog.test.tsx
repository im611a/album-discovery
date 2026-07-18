import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { createInitialUserState } from "@/features/personal-state/schema";
import { LibraryCatalog } from "./library-catalog";

describe("LibraryCatalog", () => {
  beforeEach(() => localStorage.clear());
  it("restores local categories and switches between saved and favorite albums", async () => {
    const state = createInitialUserState();
    state.savedAlbumIds = [catalogAlbums[0]!.id];
    state.favoriteAlbumIds = [catalogAlbums[1]!.id];
    localStorage.setItem("album-discovery:user-state:v1", JSON.stringify(state));
    render(<PersonalStateProvider><LibraryCatalog /></PersonalStateProvider>);
    expect(await screen.findByText(catalogAlbums[0]!.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /喜欢/ }));
    expect(await screen.findByText(catalogAlbums[1]!.title)).toBeInTheDocument();
  });
});
