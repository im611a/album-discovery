import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogAlbums } from "@/catalog/published-catalog";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { createInitialUserState } from "@/features/personal-state/schema";

import { LibraryCatalog } from "./library-catalog";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

function installState(values: Partial<ReturnType<typeof createInitialUserState>>) {
  localStorage.setItem("album-discovery:user-state:v1", JSON.stringify({ ...createInitialUserState(), ...values }));
}

function renderLibrary() {
  return render(<PersonalStateProvider><LibraryCatalog /></PersonalStateProvider>);
}

describe("LibraryCatalog", () => {
  beforeEach(() => {
    localStorage.clear();
    navigation.query = "";
    navigation.push.mockReset();
  });

  it("presents a truthful orientation and useful routes for a fresh local library", async () => {
    renderLibrary();

    expect(await screen.findByText("从一张想再次找到的专辑开始")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "我的专辑分类" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往发现页浏览专辑目录" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "前往为你推荐" })).toHaveAttribute("href", "/for-you");
    expect(screen.queryByText(/云端|同步|播放次数/)).not.toBeInTheDocument();
  });

  it("renders the 2A/2B projection with independent recent browsing and canonical album links", async () => {
    const saved = catalogAlbums.slice(0, 4);
    const recent = catalogAlbums.slice(3, 6);
    installState({ savedAlbumIds: saved.map((album) => album.id), recentAlbumIds: recent.map((album) => album.id) });
    renderLibrary();

    expect(await screen.findByText("保留的专辑")).toBeInTheDocument();
    expect(screen.getByText("最近查看", { selector: "h2" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-library-album]")).toHaveLength(4);
    expect(document.querySelectorAll("[data-library-recent]")).toHaveLength(3);
    const firstRecord = document.querySelector(`[data-library-album="${saved[0]!.id}"]`);
    expect(firstRecord).not.toBeNull();
    expect(within(firstRecord as HTMLElement).getAllByRole("link", { name: new RegExp(saved[0]!.title) })[0]).toHaveAttribute("href", expect.stringContaining(`/albums/${saved[0]!.slug}`));
    expect(screen.getByText(/按本机浏览顺序排列；它们不因此进入保留清单/)).toBeInTheDocument();
  });

  it("uses URL-backed facets, sorting and search without introducing component-local catalogue state", async () => {
    const albums = catalogAlbums.slice(0, 3);
    installState({ favoriteAlbumIds: albums.map((album) => album.id) });
    navigation.query = "view=favorite&sort=title";
    renderLibrary();

    await screen.findByText(albums[0]!.title);
    expect(document.querySelector('.r15-library-facets a[href^="/library?view=favorite"]')).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("combobox", { name: "排列" })).toHaveValue("title");
    expect(document.querySelector('.r15-library-facets a[href^="/library?view=saved"]')).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "在当前分类中查找" }), { target: { value: albums[0]!.title } });
    fireEvent.submit(screen.getByRole("search"));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("view=favorite"), { scroll: false });
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("sort=title"), { scroll: false });
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("q="), { scroll: false });
  });

  it("reflects an explicit local-state mutation in-place through the shared provider", async () => {
    const album = catalogAlbums[0]!;
    installState({ savedAlbumIds: [album.id] });
    renderLibrary();

    await screen.findByText(album.title);
    const scope = document.querySelector(`[data-library-album="${album.id}"]`) as HTMLElement;
    fireEvent.click(within(scope).getByText("本机状态"));
    fireEvent.click(within(scope).getByRole("button", { name: "已想听" }));

    expect(await screen.findByText("从一张想再次找到的专辑开始")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("album-discovery:user-state:v1") ?? "{}").savedAlbumIds).toEqual([]);
  });
});
