import { Suspense } from "react";
import { NewReleasesCatalog } from "@/components/new-releases/new-releases-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NewReleasesPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-intake-page" id="main-content"><header className="page-intro pa-intake-page__intro"><p className="eyebrow">目录变化，而非实时榜单</p><h1>最近收录</h1><p>查看新加入当前静态快照的专辑；也可切换到有明确发行日期的近期作品。</p></header><Suspense fallback={<p className="status-message">正在准备目录…</p>}><NewReleasesCatalog /></Suspense></main><SiteFooter /></div>; }
