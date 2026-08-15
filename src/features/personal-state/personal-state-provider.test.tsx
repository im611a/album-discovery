import type { ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider, usePersonalState } from "./personal-state-provider";
import { createInitialUserState } from "./schema";

function Probe() {
  const { state, hydrated, storageAvailable, toggleAlbum, reset, importJson } = usePersonalState();
  return <div><span>{hydrated ? "ready" : "loading"}</span><span>{storageAvailable ? "storage-ready" : "storage-unavailable"}</span><span>{state.savedAlbumIds.join(",")}</span><button onClick={() => toggleAlbum("savedAlbumIds", catalogAlbums[0].id)}>toggle</button><button onClick={reset}>reset</button><button onClick={() => importJson("bad")}>bad import</button></div>;
}

function StateWrapper({ children }: { children: ReactNode }) {
  return <PersonalStateProvider>{children}</PersonalStateProvider>;
}

describe("PersonalStateProvider", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it("hydrates a valid saved state", async () => {
    const state = createInitialUserState(); state.savedAlbumIds = [catalogAlbums[0].id];
    localStorage.setItem("album-discovery:user-state:v1", JSON.stringify(state));
    render(<PersonalStateProvider><Probe /></PersonalStateProvider>);
    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(screen.getByText(catalogAlbums[0].id)).toBeInTheDocument();
  });
  it("recovers from corrupt storage", async () => {
    localStorage.setItem("album-discovery:user-state:v1", "not json");
    render(<PersonalStateProvider><Probe /></PersonalStateProvider>);
    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(localStorage.getItem("album-discovery:user-state:v1")).not.toBe("not json");
  });
  it("continues without crashing when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("blocked"); });
    render(<PersonalStateProvider><Probe /></PersonalStateProvider>);
    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(screen.getByText("storage-unavailable")).toBeInTheDocument();
  });
  it("persists toggles and reset", async () => {
    render(<PersonalStateProvider><Probe /></PersonalStateProvider>);
    await screen.findByText("ready"); fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(localStorage.getItem("album-discovery:user-state:v1")).toContain(catalogAlbums[0].id));
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    await waitFor(() => expect(screen.queryByText(catalogAlbums[0].id)).not.toBeInTheDocument());
  });

  it("keeps positive and not-for-me feedback mutually exclusive", async () => {
    const albumId = catalogAlbums[0]!.id;
    const { result } = renderHook(() => usePersonalState(), { wrapper: StateWrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => {
      result.current.toggleAlbum("favoriteAlbumIds", albumId);
      result.current.toggleAlbum("savedAlbumIds", albumId);
      result.current.setFeedback(albumId, "like");
    });
    expect(result.current.state.favoriteAlbumIds).toContain(albumId);
    act(() => result.current.setFeedback(albumId, "not_for_me"));
    expect(result.current.state.favoriteAlbumIds).not.toContain(albumId);
    expect(result.current.state.savedAlbumIds).not.toContain(albumId);
    expect(result.current.state.dismissedAlbumIds).toContain(albumId);
    expect(result.current.state.recommendationFeedback[albumId]).toBe("not_for_me");
  });
  it("clears a negative state when the user later saves the album", async () => {
    const albumId = catalogAlbums[0]!.id;
    const { result } = renderHook(() => usePersonalState(), { wrapper: StateWrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.setFeedback(albumId, "not_for_me"));
    act(() => result.current.toggleAlbum("savedAlbumIds", albumId));
    expect(result.current.state.savedAlbumIds).toContain(albumId);
    expect(result.current.state.dismissedAlbumIds).not.toContain(albumId);
    expect(result.current.state.recommendationFeedback[albumId]).toBeUndefined();
  });
  it("exports only versioned user state and rejects invalid imports without replacing memory state", async () => {
    const albumId = catalogAlbums[0]!.id;
    const { result } = renderHook(() => usePersonalState(), { wrapper: StateWrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.toggleAlbum("savedAlbumIds", albumId));
    const exported = JSON.parse(result.current.exportJson());
    expect(exported.version).toBe(1);
    expect(exported.savedAlbumIds).toContain(albumId);
    expect(exported).not.toHaveProperty("catalog");
    expect(exported).not.toHaveProperty("secret");
    let invalidResult: ReturnType<typeof result.current.importJson> | undefined;
    act(() => { invalidResult = result.current.importJson("{bad json"); });
    expect(invalidResult).toEqual({ ok: false, message: "无法解析 JSON 文件。" });
    expect(result.current.state.savedAlbumIds).toContain(albumId);
  });
  it("records a meaningful album view once and moves repeated visits without duplicates", async () => {
    const first = catalogAlbums[0].id;
    const second = catalogAlbums[1].id;
    const { result } = renderHook(() => usePersonalState(), { wrapper: StateWrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.recordRecent(first));
    const firstUpdatedAt = result.current.state.updatedAt;
    act(() => result.current.recordRecent(first));
    expect(result.current.state.recentAlbumIds).toEqual([first]);
    expect(result.current.state.updatedAt).toBe(firstUpdatedAt);
    act(() => result.current.recordRecent(second));
    act(() => result.current.recordRecent(first));
    expect(result.current.state.recentAlbumIds).toEqual([first, second]);
  });
});
