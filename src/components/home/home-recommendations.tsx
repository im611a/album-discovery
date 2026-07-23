"use client";

import Link from "next/link";
import { AlbumGrid } from "@/components/album-grid";
import { recommendAlbums } from "@/catalog/recommendation";
import { getEditorialPicks } from "@/catalog/queries";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function HomeRecommendations() {
  const { state, hydrated } = usePersonalState();
  if (!hydrated) return <p className="status-message">正在读取本机偏好…</p>;
  if (!state.onboardingCompleted) return <><AlbumGrid albums={getEditorialPicks(6)} headingLevel={3} /><p className="section-more">完成上方口味设置后，这里会改为你的本地推荐。</p></>;
  const items = recommendAlbums(state, 6);
  const reasons = Object.fromEntries(items.map((item) => [item.album.id, item.reasons[0] ?? "来自你的本地口味设置。"]));
  return items.length ? <><AlbumGrid albums={items.map((item) => item.album)} reasons={reasons} headingLevel={3} /><p className="section-more"><Link href="/for-you">查看完整推荐与反馈选项 →</Link></p></> : <div className="empty-state"><h3>暂时没有新的推荐</h3><p>调整口味或撤销“不适合我”后再试试。</p></div>;
}
