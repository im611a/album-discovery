"use client";

import { useEffect } from "react";
import type { PublishedAlbum } from "@/catalog/schema";
import { AlbumActions } from "@/components/album-actions";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function AlbumDetailActions({ album }: { album: PublishedAlbum }) {
  const { hydrated, recordRecent } = usePersonalState();
  useEffect(() => {
    if (hydrated) recordRecent(album.id);
  }, [album.id, hydrated, recordRecent]);
  return <div className="ux-album-personal-actions">
    <AlbumActions album={album} mode="favorite" />
    <details>
      <summary>更多反馈</summary>
      <p>这些可选信号只用于当前设备上的推荐，不会创建新的 Library 分类。</p>
      <AlbumActions album={album} mode="feedback" />
    </details>
  </div>;
}
