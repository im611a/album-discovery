import { Suspense } from "react";
import { SearchRouteHandoff } from "@/components/search/global-search";
import { SiteShell } from "@/components/site-primitives";

export default function SearchPage() { return <SiteShell mainClassName="pa-search-compatibility"><header className="page-intro" data-page-family="utility"><p className="eyebrow">SEARCH COMPATIBILITY</p><h1>搜索已移至全站浮层</h1><p>从页头选择“搜索”，或按 Ctrl+K / Cmd+K，即可在当前位置查询本地专辑与艺人档案。</p></header><Suspense fallback={<p className="status-message">正在打开全局搜索…</p>}><SearchRouteHandoff /></Suspense></SiteShell>; }
