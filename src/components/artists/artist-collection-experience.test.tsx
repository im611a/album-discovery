import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { createInitialUserState } from "@/features/personal-state/schema";

import { ArtistAlbumStateActions, ArtistCollectionExperience } from "./artist-collection-experience";

const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));

function installState(values: Partial<ReturnType<typeof createInitialUserState>>) {
  localStorage.setItem("album-discovery:user-state:v1", JSON.stringify({ ...createInitialUserState(), ...values }));
}

describe("R16 visible Artist collection experience", () => {
  beforeEach(() => {
    localStorage.clear();
    navigation.query = "";
  });

  it("keeps a multi-work zero intersection calm and subordinate to chronology", async () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    render(<PersonalStateProvider><ArtistCollectionExperience artist={artist} /></PersonalStateProvider>);
    expect(await screen.findByRole("heading", { name: "这位艺人与我的专辑" })).toBeInTheDocument();
    expect(screen.getByText(`当前设备还没有保留 ${artist.name} 的专辑。`)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "与当前设备状态相交的作品" })).not.toBeInTheDocument();
    expect(screen.getByText(/作品年表仍完整保留/)).toBeInTheDocument();
  });

  it("updates truthful counts and membership immediately through the shared Album actions", async () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const albumId = artist.albumIds[0]!;
    render(<PersonalStateProvider><ArtistAlbumStateActions albumId={albumId} /><ArtistCollectionExperience artist={artist} /></PersonalStateProvider>);
    await screen.findByText(`当前设备还没有保留 ${artist.name} 的专辑。`);
    fireEvent.click(screen.getByText("本机状态"));
    fireEvent.click(screen.getByRole("button", { name: "想听" }));
    await waitFor(() => expect(document.querySelector("[aria-live='polite']")?.textContent).toMatch(new RegExp(`本机专辑中有 1 张来自 ${artist.name}`)));
    expect(screen.getByRole("list", { name: "与当前设备状态相交的作品" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "不适合我" }));
    expect(await screen.findByText(`当前设备还没有保留 ${artist.name} 的专辑。`)).toBeInTheDocument();
    expect(screen.getByText("不适合我", { selector: ".r16-artist-collection__index li > span:last-child" })).toBeInTheDocument();
  });

  it("uses one canonical shared-Album state across both credited Artists", async () => {
    const shared = catalogAlbums.find((album) => album.artists.length > 1)!;
    const artists = shared.artists.slice(0, 2).map((credit) => publishedArtists.find((artist) => artist.artistId === credit.id)!);
    render(<PersonalStateProvider>
      <ArtistAlbumStateActions albumId={shared.id} />
      <div data-testid="artist-a"><ArtistCollectionExperience artist={artists[0]!} /></div>
      <div data-testid="artist-b"><ArtistCollectionExperience artist={artists[1]!} /></div>
    </PersonalStateProvider>);
    await screen.findAllByText(/当前设备还没有保留/);
    fireEvent.click(screen.getByText("本机状态"));
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await waitFor(() => {
      expect(screen.getByTestId("artist-a").querySelector("[aria-live='polite']")?.textContent).toMatch(/本机专辑中有 1 张来自/);
      expect(screen.getByTestId("artist-b").querySelector("[aria-live='polite']")?.textContent).toMatch(/本机专辑中有 1 张来自/);
    });
    expect(localStorage.getItem("album-discovery:user-state:v1")).toContain(shared.id);
  });

  it("renders single-work state inline without a duplicate collection index", async () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount === 1)!;
    installState({ favoriteAlbumIds: artist.albumIds });
    render(<PersonalStateProvider><ArtistCollectionExperience artist={artist} inline /></PersonalStateProvider>);
    const inline = await screen.findByRole("complementary", { name: "这位艺人与我的专辑" });
    expect(within(inline).getByText("收藏")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "与当前设备状态相交的作品" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(`[data-album-id="${artist.albumIds[0]}"]`)).toHaveLength(1);
  });

  it("labels recent data as browsing and preserves bounded mixed navigation authority", async () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    installState({ recentAlbumIds: [artist.albumIds[0]!] });
    navigation.query = "lfrom=library&lview=recent&entry=explore&trail=wake-after-the-rain&via=SHARED_ARTIST&pfrom=for-you";
    render(<PersonalStateProvider><ArtistCollectionExperience artist={artist} /></PersonalStateProvider>);
    const list = await screen.findByRole("list", { name: "与当前设备状态相交的作品" });
    expect(within(list).getByText("最近查看")).toBeInTheDocument();
    const href = within(list).getByRole("link").getAttribute("href") ?? "";
    expect(href).toContain("lfrom=library");
    expect(href).toContain("entry=explore");
    expect(href).toContain("pfrom=for-you");
    expect(document.body.textContent).not.toMatch(/最近播放|收听历史|经常听/);
  });
});
