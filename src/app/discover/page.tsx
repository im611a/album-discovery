import Link from "next/link";
import { Suspense } from "react";
import { DiscoverCatalog } from "@/components/discover/discover-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DiscoverPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-discover" id="main-content"><header className="page-intro pa-discover__intro"><p className="eyebrow">馆藏检索台</p><h1>发现专辑</h1><p>按核心流派、可靠的 RYM 相关流派、本站聆听场景、年代与发行类型筛选。缺少离线核验数据的维度会诚实禁用，不会用推测值填充。</p></header><nav className="explore-starts pa-discover__quick-index" aria-label="探索起点"><span>快捷索引</span><Link href="/discover?genre=pop">流行</Link><Link href="/discover?decade=2000s">2000 年代</Link><Link href="/discover?type=ep">EP</Link><Link href="/discover?sort=title">标题索引</Link><Link href="/explore">换一种方式探索</Link></nav><Suspense fallback={<p className="status-message">正在准备专辑目录…</p>}><DiscoverCatalog /></Suspense></main><SiteFooter /></div>; }
