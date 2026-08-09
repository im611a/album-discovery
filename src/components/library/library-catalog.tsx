"use client";

import { useState } from "react";
import { catalogAlbums } from "@/catalog/published-catalog";
import { AlbumGrid } from "@/components/album-grid";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

const tabs = [["savedAlbumIds", "想听"], ["likedAlbumIds", "喜欢"], ["favoriteAlbumIds", "收藏"], ["listenedAlbumIds", "听过"], ["dismissedAlbumIds", "不适合我"]] as const;
export function LibraryCatalog() {
  const { state, hydrated } = usePersonalState();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("savedAlbumIds");
  if (!hydrated) return <p className="status-message">正在读取本机专辑清单…</p>;
  const albums = catalogAlbums.filter((album) => tab === "dismissedAlbumIds" ? state.dismissedAlbumIds.includes(album.id) || state.recommendationFeedback[album.id] === "not_for_me" : state[tab].includes(album.id));
  return <><div className="r12-library-toolbar"><div className="tab-list" role="tablist" aria-label="我的专辑分类">{tabs.map(([value, label]) => <button role="tab" type="button" key={value} aria-selected={tab === value} onClick={() => setTab(value)}>{label}<span>{value === "dismissedAlbumIds" ? new Set([...state.dismissedAlbumIds, ...Object.entries(state.recommendationFeedback).filter(([, item]) => item === "not_for_me").map(([id]) => id)]).size : state[value].length}</span></button>)}</div><p aria-live="polite">当前分类 {albums.length} 张</p></div>{albums.length ? <AlbumGrid albums={albums} actions="full" className="r12-library-grid" /> : <div className="empty-state r12-library-empty"><h2>这里还没有专辑</h2><p>在推荐、发现或详情页标记状态后，会自动出现在这里。</p></div>}</>;
}
