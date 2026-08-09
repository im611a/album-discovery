import { Suspense } from "react";
import { catalogAlbums } from "@/catalog/published-catalog";
import { DiscoverCatalogFallback } from "@/components/catalog-geometry-fallback";
import { DiscoverCatalog } from "@/components/discover/discover-catalog";
import { SiteShell } from "@/components/site-primitives";

export default function DiscoverPage() {
  return (
    <SiteShell mainClassName="pa-discover">
      <header className="r12-catalog-opening" data-opening-role="inventory">
        <div>
          <p className="eyebrow">BROWSE / INVENTORY</p>
          <h1>专辑目录</h1>
        </div>
        <p><strong>{catalogAlbums.length} 张作品</strong><span>搜索、排序或按真实分类缩小范围；结果仍然优先进入视野。</span></p>
      </header>
      <Suspense fallback={<DiscoverCatalogFallback albums={catalogAlbums} />}>
        <DiscoverCatalog />
      </Suspense>
    </SiteShell>
  );
}
