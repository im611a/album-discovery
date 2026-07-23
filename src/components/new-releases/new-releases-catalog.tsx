"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { getMarketChannelAlbums, getRecentReleases, getRecentlyAdded } from "@/catalog/queries";
import { catalogRefreshDate } from "@/catalog/published-catalog";
import type { SourceMarketChannel } from "@/catalog/schema";

const channels: Array<[SourceMarketChannel | "", string]> = [["", "最近收录"], ["ALL", "全部频道"], ["ZH", "华语新碟"], ["EA", "欧美新碟"], ["JP", "日本新碟"], ["KR", "韩国新碟"]];

export function NewReleasesCatalog() {
  const params = useSearchParams(); const router = useRouter();
  const requestedChannel = params.get("channel")?.toUpperCase();
  const channel = channels.some(([value]) => value === requestedChannel) ? requestedChannel as SourceMarketChannel : null;
  const view = params.get("view") === "released" ? "released" : "added";
  const albums = channel ? getMarketChannelAlbums(channel) : view === "released" ? getRecentReleases(2023) : getRecentlyAdded();
  const pushChannel = (value: SourceMarketChannel | "") => router.push(value ? `/new-releases?channel=${value.toLocaleLowerCase("en-US")}` : "/new-releases", { scroll: false });
  return <><div className="tab-list" role="tablist" aria-label="收录视图">{channels.map(([value, label]) => <button key={value || "added"} type="button" role="tab" aria-selected={value ? channel === value : !channel && view === "added"} onClick={() => pushChannel(value)}>{label}</button>)}<button type="button" role="tab" aria-selected={!channel && view === "released"} onClick={() => router.push("/new-releases?view=released", { scroll: false })}>近期发行</button></div>
    <div className="context-note"><strong>{channel ? "网易云新发行市场频道" : view === "added" ? `目录刷新于 ${catalogRefreshDate}` : "发行窗口：2023 年至今"}</strong><span>{channel ? "频道只记录专辑从哪个新发行列表被发现，不代表国籍、地区或语言。" : view === "added" ? "这里表示加入本站静态目录的时间，不是实时榜单。" : "仅按已发布快照中的发行日期筛选，不代表完整市场。"}</span></div>
    <div className="results-bar"><p><strong>{albums.length}</strong> 张专辑</p></div>{albums.length ? <AlbumGrid albums={albums} /> : <div className="empty-state"><h2>当前窗口没有足够记录</h2><p>可以返回最近收录查看完整静态目录。</p></div>}</>;
}
