import { Suspense } from "react";
import { ExploreCatalog } from "@/components/explore/explore-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ExplorePage() {
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content">
    <header className="page-intro"><p className="eyebrow">一张接一张地发现</p><h1>探索路径</h1><p>从真实核心流派、年代、本站聆听场景或艺人关联继续浏览，也可以用可分享的稳定种子随机选一张。这里不使用热度、相似度百分比或远程 AI。</p></header>
    <Suspense fallback={<p className="status-message">正在准备探索路径…</p>}><ExploreCatalog /></Suspense>
  </main><SiteFooter /></div>;
}
