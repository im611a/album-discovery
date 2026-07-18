import { Suspense } from "react";
import { DiscoverCatalog } from "@/components/discover/discover-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DiscoverPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">真实静态目录</p><h1>发现专辑</h1><p>按本站的类型、描述、场景、年代与发行类型筛选；不使用虚构评分或推测地区。</p></header><Suspense fallback={<p className="status-message">正在准备专辑目录…</p>}><DiscoverCatalog /></Suspense></main><SiteFooter /></div>; }
