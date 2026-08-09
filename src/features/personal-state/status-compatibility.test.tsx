import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AlbumActions } from "@/components/album-actions";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "./personal-state-provider";

const STORAGE_KEY = "album-discovery:user-state:v1";

describe("R7 personal-state compatibility matrix", () => {
  beforeEach(() => localStorage.clear());

  it("keeps every approved Chinese action label and persists the existing enum fields", async () => {
    const album = catalogAlbums[0];
    render(<PersonalStateProvider><AlbumActions album={album} /></PersonalStateProvider>);
    const actions = ["想听", "喜欢", "收藏", "听过", "不适合我"];
    await waitFor(() => expect(screen.getByRole("button", { name: "想听" })).toBeEnabled());
    actions.forEach((label) => fireEvent.click(screen.getByRole("button", { name: label })));
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(state).toMatchObject({
        version: 1,
        likedAlbumIds: [],
        favoriteAlbumIds: [],
        savedAlbumIds: [],
        listenedAlbumIds: [album.id],
        dismissedAlbumIds: [album.id],
      });
      expect(state.recommendationFeedback[album.id]).toBe("not_for_me");
    });
  });

  it("does not initialize a second storage key for the production homepage", async () => {
    render(<PersonalStateProvider><div>首页内容</div></PersonalStateProvider>);
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull());
    expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
  });
});
