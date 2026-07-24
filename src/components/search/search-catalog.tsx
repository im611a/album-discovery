"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { ArtistCard } from "@/components/artists/artist-card";
import { searchAlbums, searchArtists } from "@/catalog/queries";
import Link from "next/link";
import { SEARCH_PAGE_SIZE, paginate, type PageSlice } from "@/catalog/pagination";
import { CatalogPagination } from "@/components/catalog-pagination";
import type { PublishedAlbumSummary } from "@/catalog/schema";

export function SearchCatalog() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const results = searchAlbums(query);
  const artists = searchArtists(query);
  const page = paginate(results, params.get("page"), SEARCH_PAGE_SIZE);
  return <SearchCatalogView key={query} query={query} results={results} page={page} artists={artists} router={router} />;
}

function SearchCatalogView({ query, results, page, artists, router }: { query: string; results: ReturnType<typeof searchAlbums>; page: PageSlice<PublishedAlbumSummary>; artists: ReturnType<typeof searchArtists>; router: ReturnType<typeof useRouter> }) {
  const [value, setValue] = useState(query);
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const next = value.trim(); const search = new URLSearchParams(); if (next) search.set("q", next); router.push(search.size ? `/search?${search}` : "/search", { scroll: false }); }
  return <>
    <form className="search-form" role="search" onSubmit={submit}><label htmlFor="catalog-search">搜索专辑目录</label><div><input id="catalog-search" name="q" value={value} onChange={(e) => setValue(e.target.value)} placeholder="专辑、别名或艺术家" autoComplete="off" /><button className="button button--primary" type="submit">搜索</button></div></form>
    {!query ? <div className="empty-state empty-state--initial"><h2>从一个名字开始</h2><p>可以搜索中文或英文专辑名、已登记别名与艺人名称。</p></div> : <><div className="results-bar" aria-live="polite"><p>“{query}”找到 <strong>{results.length}</strong> 张专辑与 <strong>{artists.length}</strong> 位艺人</p></div>{artists.length ? <section className="search-artist-results" aria-labelledby="artist-results-title"><h2 id="artist-results-title">艺人</h2><div className="artist-grid artist-grid--search">{artists.slice(0, 6).map((artist) => <ArtistCard key={artist.artistId} artist={artist} />)}</div></section> : null}{results.length ? <section className="search-album-results" aria-labelledby="album-results-title"><h2 id="album-results-title">专辑</h2><AlbumGrid albums={page.items} highlight={query} /><CatalogPagination page={page.page} pageCount={page.pageCount} pathname="/search" /></section> : null}{!results.length && !artists.length ? <div className="empty-state"><h2>没有找到匹配内容</h2><p>试试缩短关键词，或换用专辑别名和艺人名称。</p><Link className="button button--secondary" href="/discover">前往发现页</Link></div> : null}</>}
  </>;
}
