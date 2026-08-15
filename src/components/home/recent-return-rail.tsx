"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buildRecentReturnPresentation } from "@/catalog/recent-return-presentation";
import { catalogAlbums } from "@/catalog/published-catalog";
import { AlbumCover } from "@/components/albums/album-cover";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function RecentReturnRail() {
  const { state, hydrated, storageAvailable } = usePersonalState();
  const presentation = useMemo(
    () => hydrated ? buildRecentReturnPresentation({ state, catalog: catalogAlbums }) : null,
    [hydrated, state],
  );
  if (!presentation) {
    return <section className="r17-recent-return r17-recent-return--loading" aria-busy="true" aria-label="正在读取最近查看"><p>正在读取当前设备上的最近查看…</p></section>;
  }
  return <section className="r17-recent-return" data-recent-status={presentation.status.toLowerCase()} aria-labelledby="r17-recent-return-title">
    <header className="r17-recent-return__header">
      <div><p>RETURN PATH / CURRENT DEVICE</p><h2 id="r17-recent-return-title">{presentation.heading}</h2></div>
      <p>{presentation.description}{storageAvailable ? "" : " 本次会话可用，但无法确认持久保存。"}</p>
    </header>
    {presentation.items.length ? <ol className="r17-recent-return__list">
      {presentation.items.map((item) => <li key={item.album.id}>
        <Link href={item.href} aria-label={item.accessibleLabel}>
          <span className="r17-recent-return__cover"><AlbumCover album={item.album} /></span>
          <span className="r17-recent-return__index" aria-hidden="true">{String(item.position + 1).padStart(2, "0")}</span>
          <strong>{item.album.title}</strong>
          <span>{item.album.artists.map((artist) => artist.name).join("、")}</span>
        </Link>
      </li>)}
    </ol> : <div className="r17-recent-return__empty"><p>这里还没有最近查看；先从真实目录打开一张专辑。</p><Link href="/discover">浏览专辑档案 <span aria-hidden="true">→</span></Link></div>}
    <footer><Link href={presentation.libraryHref}>查看全部 {presentation.totalCount ? `${presentation.totalCount} 张` : "最近查看"} <span aria-hidden="true">→</span></Link></footer>
  </section>;
}
