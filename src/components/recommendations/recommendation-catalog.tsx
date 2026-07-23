"use client";

import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import { TasteSetup } from "@/components/taste/taste-setup";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { recommendAlbums } from "@/catalog/recommendation";
import { getListeningSceneLabel } from "@/catalog/listening-scenes";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function RecommendationCatalog() {
  const { state, hydrated } = usePersonalState();
  if (!hydrated) return <p className="status-message">正在读取本机偏好…</p>;
  if (!state.onboardingCompleted) return <TasteSetup />;
  const recommendations = recommendAlbums(state);
  const familiar = recommendations.filter((item) => item.lane === "familiar").slice(0, 9);
  const adjacent = recommendations.filter((item) => item.lane === "adjacent").slice(0, 6);
  return <>
    <section className="taste-bar" aria-labelledby="taste-summary-title"><div><p className="section-kicker">你的口味</p><h2 id="taste-summary-title">{state.taste.genres.length ? state.taste.genres.map(getTaxonomyLabel).join("、") : "开放探索"}</h2><p>{state.taste.contexts.length ? `常见场景：${state.taste.contexts.map(getListeningSceneLabel).join("、")}` : "暂未选择固定场景"} · 反馈只保存在本机</p></div><Link className="button button--secondary" href="/settings#taste">编辑口味</Link></section>
    {recommendations.length ? <>
      <section className="catalog-section" aria-labelledby="familiar-title"><header className="section-heading"><div><p className="section-kicker">与你当前偏好重合</p><h2 id="familiar-title">熟悉方向</h2></div></header><div className="recommendation-grid">{familiar.map((item) => <AlbumCard key={item.album.id} album={item.album} reason={item.reasons.join(" ")} actions="full" headingLevel={3} />)}</div></section>
      <section className="catalog-section" aria-labelledby="adjacent-title"><header className="section-heading"><div><p className="section-kicker">保留一部分共同信号</p><h2 id="adjacent-title">试试相邻方向</h2></div></header>{adjacent.length ? <div className="recommendation-grid">{adjacent.map((item) => <AlbumCard key={item.album.id} album={item.album} reason={item.reasons.join(" ")} actions="full" headingLevel={3} />)}</div> : <p className="empty-state">给几张专辑标记“喜欢”，这里会出现更有根据的拓展选择。</p>}</section>
    </> : <div className="empty-state"><h2>暂时没有合适的新推荐</h2><p>可以在“我的专辑”里撤销“不适合我”，或重新编辑口味。</p></div>}
  </>;
}
