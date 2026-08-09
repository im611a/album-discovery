"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeSearchText } from "@/catalog/queries";
import { publishedArtists } from "@/catalog/published-catalog";
import { ArtistCard } from "./artist-card";

type ArtistSort = "name" | "album-count";

function artistIndexLabel(name: string) {
  const first = name.trim().charAt(0).toLocaleUpperCase("en-US");
  return /^[A-Z]$/.test(first) ? first : "中文及其他";
}

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
  const groups = artists.reduce<Array<{ label: string; artists: typeof artists }>>((all, artist) => {
    const label = sort === "name" ? artistIndexLabel(artist.name) : "按收录数量";
    const group = all.at(-1);
    if (group?.label === label) group.artists.push(artist);
    else all.push({ label, artists: [artist] });
    return all;
  }, []);
  const navigate = (nextQuery: string, nextSort: ArtistSort) => {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set("q", nextQuery.trim());
    if (nextSort !== "name") next.set("sort", nextSort);
    router.push(next.size ? `/artists?${next}` : "/artists", { scroll: false });
  };
  return <>
    <form className="artist-tools r12-artist-tools" role="search" onSubmit={(event) => { event.preventDefault(); navigate(value, sort); }}>
      <label>搜索艺人<input type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入艺人名称" /></label>
      <label>排序<select value={sort} onChange={(event) => navigate(query, event.target.value as ArtistSort)}><option value="name">名称</option><option value="album-count">专辑数量</option></select></label>
      <button className="button button--secondary" type="submit">搜索</button>
    </form>
    <div className="results-bar r12-artist-results"><p aria-live="polite">找到 <strong>{artists.length}</strong> 位艺人</p><p>名称 · 作品数量 · 年份跨度 · 常见核心流派</p></div>
    {artists.length ? <div className="r12-artist-index">{groups.map((group) => <section key={group.label} className="r12-artist-index__group" aria-labelledby={`artist-index-${group.label}`}><h2 id={`artist-index-${group.label}`}>{group.label}</h2><div className="artist-grid">{group.artists.map((artist) => <ArtistCard key={artist.artistId} artist={artist} />)}</div></section>)}</div> : <div className="empty-state"><h2>没有找到匹配艺人</h2><p>可以缩短名称，或浏览全部艺人。</p><button className="button button--secondary" type="button" onClick={() => { setValue(""); navigate("", "name"); }}>查看全部艺人</button></div>}
  </>;
}
