"use client";

import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import { getSimilarAlbums } from "@/catalog/exploration";
import { catalogAlbums } from "@/catalog/published-catalog";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function ContinueExploring({ albumId }: { albumId: string }) {
  const { state, hydrated } = usePersonalState();
  const album = catalogAlbums.find((item) => item.id === albumId);
  if (!album) return null;
  const results = getSimilarAlbums(album, { dismissedAlbumIds: hydrated ? state.dismissedAlbumIds : [] });
  if (!results.length) return null;
  return <section className="related-section continue-exploring" aria-labelledby="continue-exploring-title">
    <p className="section-kicker">基于真实目录字段</p>
    <h2 id="continue-exploring-title">继续探索</h2>
    <p className="support-copy">核心流派、可靠相关流派、年代和本站聆听场景共同决定；不使用评分、热度或虚构相似度。</p>
    <div className="pa-relation-paths">
      {results.slice(0, 4).map((item, index) => (
        <Link className="pa-relation-paths__item" href={`/albums/${item.album.slug}`} key={item.album.id}>
          <span className="pa-relation-paths__origin" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="pa-relation-paths__line"><i /><strong>{item.reason}</strong></span>
          <span className="pa-relation-paths__target">
            <AlbumCover album={item.album} />
            <span><strong>{item.album.title}</strong><small>{item.album.artists.map((artist) => artist.name).join("、")}</small></span>
          </span>
        </Link>
      ))}
    </div>
  </section>;
}
