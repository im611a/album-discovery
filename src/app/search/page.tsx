import { Suspense } from "react";
import { SearchCatalog } from "@/components/search/search-catalog";
import { SiteShell } from "@/components/site-primitives";

export default function SearchPage() { return <SiteShell mainClassName="pa-search r12-search-page"><header className="r12-search-opening" data-opening-role="search-instrument"><div><p className="eyebrow">LOCAL CATALOG SEARCH</p><h1>搜索</h1></div><p>输入专辑标题、别名或艺术家；关键词只在当前静态目录中处理。</p></header><Suspense fallback={<p className="status-message">正在准备搜索…</p>}><SearchCatalog /></Suspense></SiteShell>; }
