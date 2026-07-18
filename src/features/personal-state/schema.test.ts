import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { createInitialUserState, parseLocalUserState } from "./schema";

const ids = new Set(catalogAlbums.map((album) => album.id));
describe("local user state", () => {
  it("accepts version 1 and reconciles catalog identities", () => {
    const valid = createInitialUserState();
    valid.savedAlbumIds = [catalogAlbums[0].id, "removed-id", catalogAlbums[0].id];
    expect(parseLocalUserState(valid, ids)?.savedAlbumIds).toEqual([catalogAlbums[0].id]);
  });
  it("rejects corruption and unsupported versions", () => {
    expect(parseLocalUserState(null, ids)).toBeNull();
    expect(parseLocalUserState({ version: 2 }, ids)).toBeNull();
    expect(parseLocalUserState({ ...createInitialUserState(), favoriteAlbumIds: "bad" }, ids)).toBeNull();
  });

  it("normalizes contradictory imported feedback", () => {
    const albumId = catalogAlbums[0]!.id;
    const state = createInitialUserState();
    const parsed = parseLocalUserState({
      ...state,
      favoriteAlbumIds: [albumId],
      savedAlbumIds: [albumId],
      dismissedAlbumIds: [albumId],
      recommendationFeedback: { [albumId]: "not_for_me" },
    }, new Set(catalogAlbums.map((album) => album.id)));
    expect(parsed?.favoriteAlbumIds).not.toContain(albumId);
    expect(parsed?.savedAlbumIds).not.toContain(albumId);
    expect(parsed?.dismissedAlbumIds).toContain(albumId);
  });
});
