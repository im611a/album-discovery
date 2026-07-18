"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { getRecentReleases, getRecentlyAdded } from "@/catalog/queries";
import { catalogRefreshDate } from "@/catalog/published-catalog";

export function NewReleasesCatalog() {
  const params = useSearchParams(); const router = useRouter();
  const view = params.get("view") === "released" ? "released" : "added";
  const albums = view === "released" ? getRecentReleases(2023) : getRecentlyAdded();
  return <><div className="tab-list" role="tablist" aria-label="收录视图"><button type="button" role="tab" aria-selected={view === "added"} onClick={() => router.push("/new-releases", { scroll: false })}>最近收录</button><button type="button" role="tab" aria-selected={view === "released"} onClick={() => router.push("/new-releases?view=released", { scroll: false })}>近期发行</button></div>
    <div className="context-note"><strong>{view === "added" ? `目录刷新于 ${catalogRefreshDate}` : "发行窗口：2023 年至今"}</strong><span>{view === "added" ? "这里表示加入本站静态目录的时间，不是实时新碟榜。" : "仅按 MusicBrainz 已核验发行日期筛选，不代表完整的新发行市场。"}</span></div>
    <div className="results-bar"><p><strong>{albums.length}</strong> 张专辑</p></div>{albums.length ? <AlbumGrid albums={albums} /> : <div className="empty-state"><h2>当前窗口没有足够记录</h2><p>可以返回最近收录查看完整静态目录。</p></div>}</>;
}
