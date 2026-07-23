"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeSearchText } from "@/catalog/queries";
import { publishedArtists } from "@/catalog/published-catalog";
import { ArtistCard } from "./artist-card";

type ArtistSort = "name" | "album-count";

export function ArtistDirectory() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const sort = params.get("sort") === "album-count" ? "album-count" : "name";
  const [value, setValue] = useState(query);
  const normalized = normalizeSearchText(query);
  const artists = publishedArtists.filter((artist) => !normalized || normalizeSearchText([artist.name, ...artist.aliases].join(" ")).includes(normalized)).sort((a, b) =>
    sort === "album-count"
      ? b.albumCount - a.albumCount || a.name.localeCompare(b.name, "zh-CN")
      : a.name.localeCompare(b.name, "zh-CN"),
  );
  const navigate = (nextQuery: string, nextSort: ArtistSort) => {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set("q", nextQuery.trim());
    if (nextSort !== "name") next.set("sort", nextSort);
    router.push(next.size ? `/artists?${next}` : "/artists", { scroll: false });
  };
  return <>
    <form className="artist-tools" role="search" onSubmit={(event) => { event.preventDefault(); navigate(value, sort); }}>
      <label>搜索艺人<input type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入艺人名称" /></label>
      <label>排序<select value={sort} onChange={(event) => navigate(query, event.target.value as ArtistSort)}><option value="name">名称</option><option value="album-count">专辑数量</option></select></label>
      <button className="button button--secondary" type="submit">搜索</button>
    </form>
    <div className="results-bar"><p aria-live="polite">找到 <strong>{artists.length}</strong> 位艺人</p></div>
    {artists.length ? <div className="artist-grid">{artists.map((artist) => <ArtistCard key={artist.artistId} artist={artist} />)}</div> : <div className="empty-state"><h2>没有找到匹配艺人</h2><p>可以缩短名称，或浏览全部艺人。</p><button className="button button--secondary" type="button" onClick={() => { setValue(""); navigate("", "name"); }}>查看全部艺人</button></div>}
  </>;
}
