import Link from "next/link";
import { Suspense } from "react";
import { ExploreCatalog } from "@/components/explore/explore-catalog";
import { PageHeader, SiteShell } from "@/components/site-primitives";

export default function ExplorePage() {
  return <SiteShell mainClassName="pa-explore">
    <PageHeader eyebrow="一张接一张地发现" title="探索路径" className="pa-explore__intro">从真实核心流派、年代、本站聆听场景或艺人关联继续浏览，也可以用可分享的稳定种子随机选一张。这里不使用热度、相似度百分比或远程 AI。</PageHeader>
    <nav className="explore-starts" aria-label="探索入口"><Link href="/discover">按流派或年代筛选目录</Link><Link href="/scenes">聆听场景</Link></nav>
    <Suspense fallback={<p className="status-message">正在准备探索路径…</p>}><ExploreCatalog /></Suspense>
  </SiteShell>;
}
