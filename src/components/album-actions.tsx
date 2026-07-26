"use client";

import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function AlbumActions({ album, compact = false }: { album: { id: string }; compact?: boolean }) {
  const { state, hydrated, toggleAlbum, setFeedback } = usePersonalState();
  const liked = state.likedAlbumIds.includes(album.id);
  const favorite = state.favoriteAlbumIds.includes(album.id);
  const saved = state.savedAlbumIds.includes(album.id);
  const listened = state.listenedAlbumIds.includes(album.id);
  const dismissed = state.dismissedAlbumIds.includes(album.id) || state.recommendationFeedback[album.id] === "not_for_me";
  const controls = (
    <>
      <button type="button" aria-pressed={saved} disabled={!hydrated} onClick={() => toggleAlbum("savedAlbumIds", album.id)}>{saved ? "已想听" : "想听"}</button>
      <button type="button" aria-pressed={liked} disabled={!hydrated} onClick={() => setFeedback(album.id, liked ? null : "like")}>{liked ? "已喜欢" : "喜欢"}</button>
      <button type="button" aria-pressed={favorite} disabled={!hydrated} onClick={() => toggleAlbum("favoriteAlbumIds", album.id)}>{favorite ? "已收藏" : "收藏"}</button>
      <button type="button" aria-pressed={listened} disabled={!hydrated} onClick={() => toggleAlbum("listenedAlbumIds", album.id)}>{listened ? "已听过" : "听过"}</button>
      <button type="button" className="quiet-action" aria-pressed={dismissed} disabled={!hydrated} onClick={() => setFeedback(album.id, dismissed ? null : "not_for_me")}>{dismissed ? "撤销不适合" : "不适合我"}</button>
    </>
  );
  if (compact) {
    const selectedCount = [saved, liked, favorite, listened, dismissed].filter(Boolean).length;
    return (
      <details className="album-actions album-actions--compact">
        <summary>
          <span>本机状态</span>
          <small>{selectedCount ? `${selectedCount} 项已选` : "未标记"}</small>
        </summary>
        <div aria-label="我的专辑状态">{controls}</div>
      </details>
    );
  }
  return (
    <div className="album-actions" aria-label="我的专辑状态">
      {controls}
    </div>
  );
}
