import { Suspense } from "react";
import { SearchCatalog } from "@/components/search/search-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SearchPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-search" id="main-content"><header className="page-intro pa-search__intro"><p className="eyebrow">本地即时搜索</p><h1>搜索</h1><p>按专辑标题、别名或艺术家查找，不向外部服务发送关键词。</p></header><Suspense fallback={<p className="status-message">正在准备搜索…</p>}><SearchCatalog /></Suspense></main><SiteFooter /></div>; }
