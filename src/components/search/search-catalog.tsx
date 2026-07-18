"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { searchAlbums } from "@/catalog/queries";

export function SearchCatalog() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const results = searchAlbums(query);
  return <SearchCatalogView key={query} query={query} results={results} router={router} />;
}

function SearchCatalogView({ query, results, router }: { query: string; results: ReturnType<typeof searchAlbums>; router: ReturnType<typeof useRouter> }) {
  const [value, setValue] = useState(query);
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const next = value.trim(); const search = new URLSearchParams(); if (next) search.set("q", next); router.push(search.size ? `/search?${search}` : "/search", { scroll: false }); }
  return <>
    <form className="search-form" role="search" onSubmit={submit}><label htmlFor="catalog-search">搜索真实专辑目录</label><div><input id="catalog-search" name="q" value={value} onChange={(e) => setValue(e.target.value)} placeholder="专辑、艺术家、流派、描述或聆听场景" autoComplete="off" /><button className="button button--primary" type="submit">搜索</button></div></form>
    {!query ? <div className="empty-state empty-state--initial"><h2>从一个名字或感觉开始</h2><p>例如“王菲”“ambient”“夜晚”或“朦胧”。</p></div> : <><div className="results-bar" aria-live="polite"><p>“{query}”找到 <strong>{results.length}</strong> 张专辑</p></div>{results.length ? <AlbumGrid albums={results} highlight={query} /> : <div className="empty-state"><h2>没有找到匹配专辑</h2><p>试试缩短关键词，或改用艺术家、流派和场景词。</p></div>}</>}
  </>;
}
