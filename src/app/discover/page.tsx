import { Suspense } from "react";

import { DiscoverCatalog } from "@/components/discover/discover-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { albumsMock } from "@/data/albums.mock";

export default function DiscoverPage() {
  return (
    <div className="site-shell">
      <SiteHeader activePath="/discover" />
      <main className="discover-main page-container" id="main-content">
        <header className="discover-intro">
          <p className="eyebrow">统一专辑目录</p>
          <h1>发现专辑</h1>
          <p>
            按年份、发行类型和 RYM 分类浏览；所有内容当前均为本地虚构原型数据。
          </p>
        </header>
        <Suspense
          fallback={<p className="discover-loading">正在准备本地专辑目录…</p>}
        >
          <DiscoverCatalog albums={albumsMock} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
