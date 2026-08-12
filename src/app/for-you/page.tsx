import type { Metadata } from "next";
import { RecommendationCatalog } from "@/components/recommendations/recommendation-catalog";
import { SiteShell } from "@/components/site-primitives";
import { Suspense } from "react";
export const metadata: Metadata = { title: "为你推荐 · 专辑发现", description: "基于本机口味与反馈生成可解释的专辑推荐。" };
export default function ForYouPage() { return <SiteShell mainClassName="pa-recommendations r12-recommendations"><header className="r12-recommendation-opening" data-opening-role="taste-to-album"><div><p className="eyebrow">LOCAL RECOMMENDATION</p><h1>为你推荐</h1></div><p>口味与显式反馈进入本机计算，随后给出有依据的专辑选择。</p><span aria-hidden="true">口味输入 → 专辑输出</span></header><Suspense fallback={<p className="status-message">正在读取本机偏好…</p>}><RecommendationCatalog /></Suspense></SiteShell>; }
