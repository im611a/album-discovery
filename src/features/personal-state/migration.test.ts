import { describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { createInitialUserState, parseLocalUserState } from "./schema";

const ids = new Set(catalogAlbums.map((album) => album.id));

describe("local state migration and reconciliation", () => {
  it("migrates a recognizable pre-version state", () => {
    const id = catalogAlbums[0]!.id;
    const migrated = parseLocalUserState({ favoriteAlbumIds: [id], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], recommendationFeedback: {}, taste: createInitialUserState().taste }, ids);
    expect(migrated?.version).toBe(1);
    expect(migrated?.favoriteAlbumIds).toEqual([id]);
    expect(migrated?.recommendationFeedback[id]).toBe("like");
  });

  it("rejects future versions without destructively guessing their shape", () => expect(parseLocalUserState({ ...createInitialUserState(), version: 2 }, ids)).toBeNull());
  it("rejects unrecognizable missing-version data", () => expect(parseLocalUserState({ arbitrary: true }, ids)).toBeNull());

  it("migrates legacy Chinese descriptor values to stable taxonomy keys", () => {
    const value = createInitialUserState();
    value.taste = { ...value.taste, descriptors: ["朦胧", "层次丰富"] };
    expect(parseLocalUserState(value, ids)?.taste.descriptors).toEqual(["hazy", "layered"]);
  });

  it("reconciles removed catalog IDs from every album collection", () => {
    const value = createInitialUserState();
    value.favoriteAlbumIds = value.savedAlbumIds = value.listenedAlbumIds = value.dismissedAlbumIds = value.recentAlbumIds = ["removed"];
    value.taste = { ...value.taste, seedAlbumIds: ["removed"] };
    expect(parseLocalUserState(value, ids)).toMatchObject({ favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], taste: { seedAlbumIds: [] } });
  });

  it("makes not-for-me authoritative over conflicting favorite and saved states", () => {
    const id = catalogAlbums[0]!.id;
    const value = { ...createInitialUserState(), favoriteAlbumIds: [id], savedAlbumIds: [id], recommendationFeedback: { [id]: "not_for_me" as const } };
    const parsed = parseLocalUserState(value, ids)!;
    expect(parsed.favoriteAlbumIds).not.toContain(id);
    expect(parsed.savedAlbumIds).not.toContain(id);
    expect(parsed.dismissedAlbumIds).toContain(id);
  });
});
