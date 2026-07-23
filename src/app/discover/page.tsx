import { Suspense } from "react";
import { DiscoverCatalog } from "@/components/discover/discover-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DiscoverPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">网易云目录 · 本地策展</p><h1>发现专辑</h1><p>按实际存在的核心流派、相关流派、氛围特征、场景、年代与发行类型筛选；相关流派和氛围特征只来自可靠离线 RYM 匹配，不代表网易云官方标签。</p></header><Suspense fallback={<p className="status-message">正在准备专辑目录…</p>}><DiscoverCatalog /></Suspense></main><SiteFooter /></div>; }
