import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { buildPersonalJourneyPresentation } from "@/catalog/personalization";
import { PersonalStateProvider, usePersonalState } from "./personal-state-provider";
import { createInitialUserState, MAX_LOCAL_RECENT_ALBUMS, MAX_LOCAL_TASTE_VALUES, parseLocalUserState } from "./schema";

const ids = new Set(catalogAlbums.map((album) => album.id));
const validIds = catalogAlbums.map((album) => album.id);
const base = createInitialUserState();

describe("R14-3H adversarial local-state integrity matrix", () => {
  it("A: absent and empty state cannot manufacture personal evidence", () => {
    for (const value of [undefined, null, {}, createInitialUserState()]) {
      const result = buildPersonalJourneyPresentation({ state: value, context: "HOME", source: "home" });
      expect(result.status).toBe("EMPTY");
      expect(result.primary).toBeNull();
    }
  });

  it.each([
    ["likedAlbumIds", "LIKED_ALBUM_BRIDGE"],
    ["favoriteAlbumIds", "FAVORITE_ALBUM_BRIDGE"],
    ["savedAlbumIds", "SAVED_ALBUM_BRIDGE"],
    ["recentAlbumIds", "RECENT_VIEW_BRIDGE"],
  ] as const)("B: one %s yields only its accepted evidence family", (key, family) => {
    const parsed = parseLocalUserState({ ...base, [key]: [validIds[0]] }, ids)!;
    const result = buildPersonalJourneyPresentation({ state: parsed, context: "FOR_YOU", source: "for-you" });
    expect(result.primary?.provenance).toBe("PERSONAL");
    expect(result.primary?.explanationKey).toBe(`personal.${family.toLowerCase()}`);
  });

  it("C/H: dense oversized state is bounded, deduplicated and deterministic", () => {
    const repeated = Array.from({ length: 5_000 }, (_, index) => validIds[index % validIds.length]);
    const signals = Array.from({ length: 2_000 }, (_, index) => `signal-${index}`);
    const input = { ...base, likedAlbumIds: repeated, favoriteAlbumIds: repeated, savedAlbumIds: repeated, listenedAlbumIds: repeated, recentAlbumIds: repeated, taste: { ...base.taste, genres: signals, descriptors: signals, contexts: signals, eras: signals } };
    const first = parseLocalUserState(input, ids)!;
    const replay = parseLocalUserState(input, ids)!;
    expect(first).toEqual(replay);
    expect(first.likedAlbumIds).toHaveLength(validIds.length);
    expect(first.recentAlbumIds).toHaveLength(MAX_LOCAL_RECENT_ALBUMS);
    expect(first.taste.genres).toHaveLength(MAX_LOCAL_TASTE_VALUES);
    expect(new Set(first.savedAlbumIds).size).toBe(first.savedAlbumIds.length);
  });

  it("D: negative evidence takes precedence over every positive collection", () => {
    const albumId = validIds[0];
    const parsed = parseLocalUserState({ ...base, likedAlbumIds: [albumId], favoriteAlbumIds: [albumId], savedAlbumIds: [albumId], listenedAlbumIds: [albumId], recentAlbumIds: [albumId], dismissedAlbumIds: [albumId], recommendationFeedback: { [albumId]: "not_for_me" } }, ids)!;
    expect(parsed.dismissedAlbumIds).toEqual([albumId]);
    expect(parsed.likedAlbumIds).toEqual([]);
    expect(parsed.favoriteAlbumIds).toEqual([]);
    expect(parsed.savedAlbumIds).toEqual([]);
    expect(parsed.listenedAlbumIds).toEqual([albumId]);
    expect(parsed.recentAlbumIds).toEqual([albumId]);
    const result = buildPersonalJourneyPresentation({ state: parsed, context: "FOR_YOU", source: "for-you" });
    expect([result.primary, ...result.secondary, ...result.fallback].filter(Boolean).map((option) => option!.album.id)).not.toContain(albumId);
  });

  it("E/F: stale and duplicate IDs leave no ghost target or explanation", () => {
    const albumId = validIds[0];
    const parsed = parseLocalUserState({ ...base, likedAlbumIds: ["stale", albumId, albumId], recentAlbumIds: ["stale", albumId, albumId] }, ids)!;
    expect(parsed.likedAlbumIds).toEqual([albumId]);
    expect(parsed.recentAlbumIds).toEqual([albumId]);
    expect(JSON.stringify(buildPersonalJourneyPresentation({ state: parsed, context: "FOR_YOU", source: "for-you" }))).not.toContain("stale");
  });

  it("G/I: malformed roots and future versions fail safely", () => {
    for (const value of [null, [], "bad", 42, { version: 99 }, { version: 1, taste: null }, { ...base, likedAlbumIds: {} }]) expect(parseLocalUserState(value, ids)).toBeNull();
    expect(parseLocalUserState({ ...base, version: 1 }, ids)?.version).toBe(1);
    expect(parseLocalUserState({ taste: base.taste, favoriteAlbumIds: [validIds[0]], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recentAlbumIds: [], recommendationFeedback: {} }, ids)?.version).toBe(1);
  });
});

describe("R14-3H storage degradation", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it.each(["getItem", "setItem", "removeItem"] as const)("J: %s failure still hydrates a browsable non-crashing provider", async (method) => {
    if (method === "removeItem") localStorage.setItem("album-discovery:user-state:v1", "invalid json");
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("storage blocked"); });
    const { result } = renderHook(() => usePersonalState(), { wrapper: PersonalStateProvider });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    if (method === "setItem") await waitFor(() => expect(result.current.storageAvailable).toBe(false));
    else expect(result.current.storageAvailable).toBe(false);
    expect(result.current.state).toMatchObject({ version: 1, likedAlbumIds: [], recentAlbumIds: [] });
    expect(() => act(() => result.current.reset())).not.toThrow();
  });
});
