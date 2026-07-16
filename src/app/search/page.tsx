import { Suspense } from "react";

import { SearchCatalog } from "@/components/search/search-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { albumsMock } from "@/data/albums.mock";

export default function SearchPage() {
  return (
    <div className="site-shell">
      <SiteHeader activePath="/search" />
      <main className="search-main page-container" id="main-content">
        <header className="search-intro">
          <p className="eyebrow">本地静态原型</p>
          <h1>搜索专辑</h1>
          <p>按专辑名称、别名或艺术家名称搜索当前 18 张本地虚构专辑。</p>
        </header>

        <Suspense fallback={<p className="search-loading">正在准备本地搜索…</p>}>
          <SearchCatalog albums={albumsMock} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
