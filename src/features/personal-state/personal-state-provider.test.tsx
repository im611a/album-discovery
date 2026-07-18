import type { ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider, usePersonalState } from "./personal-state-provider";
import { createInitialUserState } from "./schema";

function Probe() {
  const { state, hydrated, toggleAlbum, reset, importJson } = usePersonalState();
  return <div><span>{hydrated ? "ready" : "loading"}</span><span>{state.savedAlbumIds.join(",")}</span><button onClick={() => toggleAlbum("savedAlbumIds", catalogAlbums[0].id)}>toggle</button><button onClick={reset}>reset</button><button onClick={() => importJson("bad")}>bad import</button></div>;
}

function StateWrapper({ children }: { children: ReactNode }) {
  return <PersonalStateProvider>{children}</PersonalStateProvider>;
}

describe("PersonalStateProvider", () => {
  beforeEach(() => localStorage.clear());
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
});
