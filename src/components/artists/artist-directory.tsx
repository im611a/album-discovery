"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ARTIST_GENRE_GROUPS, countArtistGenreGroups, getArtistGenreGroup, type ArtistGenreGroup } from "@/catalog/artist-primary-genre";
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
  const sort: ArtistSort = params.get("sort") === "name" ? "name" : "album-count";
  const requestedCategory = params.get("genre");
  const category: ArtistGenreGroup = ARTIST_GENRE_GROUPS.some(({ key }) => key === requestedCategory)
    ? requestedCategory as ArtistGenreGroup
    : "all";
  const [value, setValue] = useState(query);
  const normalized = normalizeSearchText(query);
  const categoryCounts = countArtistGenreGroups(publishedArtists);
  const artists = publishedArtists.filter((artist) =>
    (category === "all" || getArtistGenreGroup(artist) === category) &&
    (!normalized || normalizeSearchText([artist.name, ...artist.aliases].join(" ")).includes(normalized)),
  ).sort((a, b) =>
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
  const hrefFor = (nextCategory: ArtistGenreGroup, nextQuery = query, nextSort = sort) => {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set("q", nextQuery.trim());
    if (nextSort !== "album-count") next.set("sort", nextSort);
    if (nextCategory !== "all") next.set("genre", nextCategory);
    return next.size ? `/artists?${next}` : "/artists";
  };
  const navigate = (nextQuery: string, nextSort: ArtistSort) => router.push(hrefFor(category, nextQuery, nextSort), { scroll: false });
  return <>
    <nav className="ux-artist-categories" aria-label="按艺人主流派缩小范围">
      <header><p className="section-kicker">先按音乐缩小范围</p><h2>主流派分类</h2><p>依据每位艺人已收录专辑的核心流派数量确定；数量并列时按稳定流派 key 排序，不使用姓名或地区推断。</p></header>
      <div>{ARTIST_GENRE_GROUPS.map(({ key, label }) => <Link key={key} href={hrefFor(key)} aria-current={category === key ? "page" : undefined}><strong>{label}</strong><span>{categoryCounts[key]}</span></Link>)}</div>
    </nav>
    <form className="artist-tools r12-artist-tools" role="search" onSubmit={(event) => { event.preventDefault(); navigate(value, sort); }}>
      <label>搜索艺人<input type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入艺人名称" /></label>
      <label>排序<select value={sort} onChange={(event) => navigate(query, event.target.value as ArtistSort)}><option value="album-count">专辑数量</option><option value="name">名称</option></select></label>
      <button className="button button--secondary" type="submit">搜索</button>
    </form>
    <div className="results-bar r12-artist-results"><p aria-live="polite">找到 <strong>{artists.length}</strong> 位艺人</p><p>名称 · 作品数量 · 年份跨度 · 常见核心流派</p></div>
    {artists.length ? <div className="r12-artist-index" data-artist-category={category}>{groups.map((group) => <section key={group.label} className="r12-artist-index__group" aria-labelledby={`artist-index-${group.label}`}><h2 id={`artist-index-${group.label}`}>{group.label}</h2><div className="artist-grid">{group.artists.map((artist) => <ArtistCard key={artist.artistId} artist={artist} />)}</div></section>)}</div> : <div className="empty-state"><h2>没有找到匹配艺人</h2><p>可以缩短名称，或切换主流派分类。</p><button className="button button--secondary" type="button" onClick={() => { setValue(""); router.push("/artists", { scroll: false }); }}>查看全部艺人</button></div>}
  </>;
}
