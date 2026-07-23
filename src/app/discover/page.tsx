import Link from "next/link";
import { Suspense } from "react";
import { DiscoverCatalog } from "@/components/discover/discover-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DiscoverPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">网易云目录 · 本地策展</p><h1>发现专辑</h1><p>按核心流派、相关流派、氛围与特征、聆听场景、年代与发行类型筛选。相关流派和氛围与特征只发布可靠离线 RYM 匹配值；聆听场景是与 RYM 分类分离的本站策展维度。</p></header><nav className="explore-starts" aria-label="探索起点"><Link href="/discover?genre=pop">流行</Link><Link href="/discover?decade=2000s">2000 年代</Link><Link href="/discover?type=ep">EP</Link><Link href="/discover?sort=title">换个顺序浏览</Link></nav><Suspense fallback={<p className="status-message">正在准备专辑目录…</p>}><DiscoverCatalog /></Suspense></main><SiteFooter /></div>; }
