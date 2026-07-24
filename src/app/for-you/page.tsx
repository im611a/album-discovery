import type { Metadata } from "next";
import { RecommendationCatalog } from "@/components/recommendations/recommendation-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = { title: "为你推荐 · 专辑发现", description: "基于本机口味与反馈生成可解释的专辑推荐。" };
export default function ForYouPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">本机计算 · 有理由的选择</p><h1>为你推荐</h1><p>推荐由核心流派、聆听场景、年代、发行类型与显式反馈确定；没有远程 AI，也不会上传你的口味。</p></header><RecommendationCatalog /></main><SiteFooter /></div>; }
