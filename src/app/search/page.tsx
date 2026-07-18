import { Suspense } from "react";
import { SearchCatalog } from "@/components/search/search-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SearchPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">本地即时搜索</p><h1>搜索</h1><p>查找专辑、艺术家、类型、描述、场景与中文导览文字，不向外部服务发送关键词。</p></header><Suspense fallback={<p className="status-message">正在准备搜索…</p>}><SearchCatalog /></Suspense></main><SiteFooter /></div>; }
