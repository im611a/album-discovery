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
  const mainCandidate = familiar[0] ?? adjacent[0];
  const neighborCandidates = familiar.slice(1, 3);
  const remainingFamiliar = familiar.slice(3);
  return <>
    <section className="taste-bar r12-taste-strip" aria-labelledby="taste-summary-title"><div><p className="section-kicker">当前口味信号</p><h2 id="taste-summary-title">{state.taste.genres.length ? state.taste.genres.map(getTaxonomyLabel).join("、") : "开放探索"}</h2><p>{state.taste.contexts.length ? `场景：${state.taste.contexts.map(getListeningSceneLabel).join("、")}` : "暂未选择固定场景"} · 反馈只保存在本机</p></div><Link className="button button--secondary" href="/settings#taste">调整信号</Link></section>
    {recommendations.length ? <>
      {mainCandidate ? <section className="pa-candidate-stage r12-recommendation-lead" aria-labelledby="familiar-title">
        <header className="section-heading"><div><p className="section-kicker">与你当前偏好重合</p><h2 id="familiar-title">首先听这张</h2></div><p>理由直接来自当前目录与本机反馈</p></header>
        <div className="pa-candidate-stage__layout r12-recommendation-lead__layout">
          <div className="pa-candidate-stage__main r12-recommendation-lead__main"><AlbumCard album={mainCandidate.album} reason={mainCandidate.reasons.join(" ")} headingLevel={3} /></div>
          <aside className="pa-candidate-stage__neighbors r12-recommendation-lead__alternates" aria-label="相邻候选"><p className="section-kicker">相邻方向</p>{neighborCandidates.map((item, index) => <div key={item.album.id} data-neighbor={index ? "next" : "previous"}><span>{index ? "NEXT" : "ALSO"}</span><AlbumCard album={item.album} reason={item.reasons.join(" ")} headingLevel={3} /></div>)}</aside>
        </div>
      </section> : null}
      {remainingFamiliar.length ? <section className="catalog-section pa-candidate-ledger" aria-labelledby="more-familiar-title"><header className="section-heading"><div><p className="section-kicker">同一方向的其他候选</p><h2 id="more-familiar-title">继续翻阅</h2></div></header><div className="recommendation-grid">{remainingFamiliar.map((item) => <AlbumCard key={item.album.id} album={item.album} reason={item.reasons.join(" ")} headingLevel={3} />)}</div></section> : null}
      <section className="catalog-section pa-adjacent-stage" aria-labelledby="adjacent-title"><header className="section-heading"><div><p className="section-kicker">保留一部分共同信号</p><h2 id="adjacent-title">试试相邻方向</h2></div></header>{adjacent.length ? <div className="recommendation-grid">{adjacent.map((item) => <AlbumCard key={item.album.id} album={item.album} reason={item.reasons.join(" ")} headingLevel={3} />)}</div> : <p className="empty-state">给几张专辑标记“喜欢”，这里会出现更有根据的拓展选择。</p>}</section>
    </> : <div className="empty-state"><h2>暂时没有合适的新推荐</h2><p>可以在“我的专辑”里撤销“不适合我”，或重新编辑口味。</p></div>}
  </>;
}
