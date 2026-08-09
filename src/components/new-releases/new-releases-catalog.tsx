"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArchiveAlbumRow } from "@/components/archive/archive-album-row";
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
  const archiveGroups = albums.reduce<Array<{ key: string; label: string; albums: typeof albums }>>((groups, album) => {
    const key = channel || view === "released" ? album.releaseDate?.slice(0, 4) ?? "unknown" : album.discoveredAt.slice(0, 10);
    const label = channel || view === "released" ? (key === "unknown" ? "发行年份暂缺" : `${key} 年发行`) : `${key} 收录`;
    const group = groups.at(-1);
    if (group?.key === key) group.albums.push(album); else groups.push({ key, label, albums: [album] });
    return groups;
  }, []);
  const pushChannel = (value: SourceMarketChannel | "") => router.push(value ? `/new-releases?channel=${value.toLocaleLowerCase("en-US")}` : "/new-releases", { scroll: false });
  return <><div className="tab-list r12-intake-tabs" role="tablist" aria-label="收录视图">{channels.map(([value, label]) => <button key={value || "added"} type="button" role="tab" aria-selected={value ? channel === value : !channel && view === "added"} onClick={() => pushChannel(value)}>{label}</button>)}<button type="button" role="tab" aria-selected={!channel && view === "released"} onClick={() => router.push("/new-releases?view=released", { scroll: false })}>近期发行</button></div>
    <div className="context-note"><strong>{channel ? "网易云新发行市场频道" : view === "added" ? `目录刷新于 ${catalogRefreshDate}` : "发行窗口：2023 年至今"}</strong><span>{channel ? "频道只记录专辑从哪个新发行列表被发现，不代表国籍、地区或语言。" : view === "added" ? "这里表示加入本站静态目录的时间，不是实时榜单。" : "仅按已发布快照中的发行日期筛选，不代表完整市场。"}</span></div>
    <div className="results-bar"><p><strong>{albums.length}</strong> 张专辑 · {archiveGroups.length} 个时间批次</p></div>{albums.length ? <div className="r12-intake-ledger" data-archive-basis={channel || view === "released" ? "release" : "catalog-added"}>{archiveGroups.map((group) => <section key={group.key} className="r12-intake-group" aria-labelledby={`intake-${group.key}`}><header><h2 id={`intake-${group.key}`}>{group.label}</h2><span>{group.albums.length} 张</span></header><div>{group.albums.map((album) => <ArchiveAlbumRow key={album.id} album={album} />)}</div></section>)}</div> : <div className="empty-state"><h2>当前窗口没有足够记录</h2><p>可以返回最近收录查看完整静态目录。</p></div>}</>;
}
