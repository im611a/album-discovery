import { Suspense } from "react";
import { catalogRefreshDate } from "@/catalog/published-catalog";
import { NewReleasesCatalog } from "@/components/new-releases/new-releases-catalog";
import { SiteShell } from "@/components/site-primitives";

export default function NewReleasesPage() { return <SiteShell mainClassName="pa-intake-page r12-intake-archive"><header className="r12-intake-opening" data-opening-role="intake-log"><div><p className="eyebrow">CATALOG INTAKE LOG</p><h1>最近收录</h1></div><p>按加入当前静态目录的日期浏览；发行窗口与市场频道保持为独立视图。</p><time dateTime={catalogRefreshDate}>刷新 {catalogRefreshDate}</time></header><Suspense fallback={<p className="status-message">正在准备目录…</p>}><NewReleasesCatalog /></Suspense></SiteShell>; }
