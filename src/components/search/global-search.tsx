"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { searchAlbums, searchArtists } from "@/catalog/queries";
import { buildSearchOriginHref } from "@/catalog/navigation-origin";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { AlbumCover } from "@/components/albums/album-cover";
import { withBasePath } from "@/lib/site-path";
import { cn } from "@/lib/utils";

interface GlobalSearchContextValue {
  openSearch: (query?: string, trigger?: HTMLElement | null) => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

export function useGlobalSearch() {
  const value = useContext(GlobalSearchContext);
  if (!value) throw new Error("全局搜索必须位于 GlobalSearchProvider 内。");
  return value;
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeSearch = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => returnFocusRef.current?.focus());
  }, []);
  const openSearch = useCallback((nextQuery = "", trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setQuery(nextQuery);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("en-US") === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  return <GlobalSearchContext.Provider value={{ openSearch }}>
    {children}
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : closeSearch()}>
      <Dialog.Portal>
        <Dialog.Overlay className="global-search__overlay" />
        <GlobalSearchDialog
          query={query}
          setQuery={setQuery}
          close={closeSearch}
          returnFocus={() => returnFocusRef.current?.focus()}
        />
      </Dialog.Portal>
    </Dialog.Root>
  </GlobalSearchContext.Provider>;
}

export function GlobalSearchTrigger({ className, children = "搜索", onOpen }: { className?: string; children?: ReactNode; onOpen?: () => void }) {
  const { openSearch } = useGlobalSearch();
  return <button className={cn("global-search-trigger", className)} type="button" onClick={(event) => { onOpen?.(); openSearch("", event.currentTarget); }}>{children}</button>;
}

function GlobalSearchDialog({ query, setQuery, close, returnFocus }: {
  query: string;
  setQuery: (value: string) => void;
  close: () => void;
  returnFocus: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const albums = useMemo(() => query.trim() ? searchAlbums(query).slice(0, 7) : [], [query]);
  const artists = useMemo(() => query.trim() ? searchArtists(query).slice(0, 5) : [], [query]);
  const results = useMemo(() => [
    ...albums.map((album) => ({ id: `album-${album.id}`, href: buildSearchOriginHref(`/albums/${album.slug}`, query, 1) })),
    ...artists.map((artist) => ({ id: `artist-${artist.artistId}`, href: buildSearchOriginHref(`/artists/${artist.slug}`, query, 1) })),
  ], [albums, artists, query]);

  function activate(index: number) {
    const result = results[index];
    if (!result) return;
    close();
    router.push(result.href);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => (value + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => (value - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      activate(activeIndex);
    }
  }

  return <Dialog.Content
    className="global-search"
    aria-describedby="global-search-description"
    onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}
    onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus(); }}
  >
    <header className="global-search__header">
      <div><p className="eyebrow">LOCAL CATALOG / COMMAND K</p><Dialog.Title>搜索专辑与艺人</Dialog.Title></div>
      <Dialog.Close className="global-search__close" aria-label="关闭搜索">×</Dialog.Close>
    </header>
    <Dialog.Description className="global-search__description" id="global-search-description">只查询随站点发布的本地目录，不请求外部音乐服务。</Dialog.Description>
    <div className="global-search__input-row">
      <span aria-hidden="true">⌘K</span>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
        onKeyDown={onKeyDown}
        placeholder="专辑、别名或艺人"
        aria-label="全局搜索"
        aria-controls="global-search-results"
        aria-activedescendant={results[activeIndex]?.id}
        autoComplete="off"
      />
    </div>
    <div className="global-search__results" id="global-search-results" aria-live="polite">
      {!query.trim() ? <p className="global-search__hint">输入名字开始检索 · ↑↓ 选择 · Enter 打开 · Esc 关闭</p> : null}
      {query.trim() && !results.length ? <p className="global-search__hint">没有匹配结果，试试缩短关键词。</p> : null}
      {albums.length ? <section aria-labelledby="global-search-albums"><h2 id="global-search-albums">专辑 <span>{albums.length}</span></h2><ul>{albums.map((album, index) => <li key={album.id}><Link id={`album-${album.id}`} data-active={activeIndex === index} href={buildSearchOriginHref(`/albums/${album.slug}`, query, 1)} onMouseEnter={() => setActiveIndex(index)} onClick={close}><AlbumCover album={album} /><span><strong>{album.title}</strong><small>{album.artists.map((artist) => artist.name).join("、")}</small></span></Link></li>)}</ul></section> : null}
      {artists.length ? <section aria-labelledby="global-search-artists"><h2 id="global-search-artists">艺人 <span>{artists.length}</span></h2><ul>{artists.map((artist, index) => { const itemIndex = albums.length + index; return <li key={artist.artistId}><Link id={`artist-${artist.artistId}`} data-active={activeIndex === itemIndex} href={buildSearchOriginHref(`/artists/${artist.slug}`, query, 1)} onMouseEnter={() => setActiveIndex(itemIndex)} onClick={close}>{artist.previewCovers[0] ? <Image src={withBasePath(artist.previewCovers[0])} width={72} height={72} alt="" unoptimized /> : <span className="global-search__monogram" aria-hidden="true">{artist.name.slice(0, 1)}</span>}<span><strong>{artist.name}</strong><small>{artist.albumCount} 张专辑{artist.commonCoreGenres[0] ? ` · ${getTaxonomyLabel(artist.commonCoreGenres[0])}` : ""}</small></span></Link></li>; })}</ul></section> : null}
    </div>
  </Dialog.Content>;
}

export function SearchRouteHandoff() {
  const params = useSearchParams();
  const { openSearch } = useGlobalSearch();
  const query = params.get("q")?.trim() ?? "";
  useEffect(() => openSearch(query), [openSearch, query]);
  return <div className="search-route-handoff"><p>搜索已经移到全站浮层；旧链接仍会保留关键词并直接打开搜索。</p><button className="button button--primary" type="button" onClick={(event) => openSearch(query, event.currentTarget)}>打开全局搜索</button></div>;
}
