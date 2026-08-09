import { AlbumGrid } from "@/components/album-grid";
import { CATALOG_PAGE_SIZE, paginate } from "@/catalog/pagination";
import { buildCatalogViewModel, parseCatalogQuery } from "@/catalog/catalog-view-model";
import { filterTopicAlbums, type TopicKind } from "@/catalog/topics";
import type { PublishedAlbumSummary } from "@/catalog/schema";

function StaticSelect({ label }: { label: string }) {
  return <label>{label}<select aria-hidden="true" tabIndex={-1} defaultValue=""><option value="">全部</option></select></label>;
}

function StaticPagination({ pageCount }: { pageCount: number }) {
  if (pageCount <= 1) return null;
  return <nav className="catalog-pagination" aria-hidden="true"><button type="button" tabIndex={-1} disabled>上一页</button><p>第 <strong>1</strong> / {pageCount} 页</p><button type="button" tabIndex={-1}>下一页</button></nav>;
}

export function DiscoverCatalogFallback({ albums }: { albums: PublishedAlbumSummary[] }) {
  const query = parseCatalogQuery(new URLSearchParams(), albums);
  const model = buildCatalogViewModel({ albums, query, userState: null });
  const page = paginate(model.albums, null, CATALOG_PAGE_SIZE);

  return <div className="catalog-geometry-fallback" aria-busy="true" aria-label="正在准备专辑目录">
    <section className="r12-catalog-toolbar" aria-hidden="true">
      <div className="r12-catalog-toolbar__status">
        <div><p className="section-kicker">浏览结果</p><h2>{model.resultCount} 张专辑</h2></div>
        <p>第 1 / {page.pageCount} 页 · 当前显示 {page.items.length} 张</p>
      </div>
      <div className="r12-catalog-toolbar__primary">
        <div className="catalog-search-form"><label>搜索专辑或艺人</label><div><input type="search" tabIndex={-1} readOnly /><button className="button button--primary" type="button" tabIndex={-1}>搜索</button></div></div>
        <div className="filter-grid filter-grid--primary"><StaticSelect label="核心流派" /><StaticSelect label="排序" /></div>
        <details className="catalog-advanced-filters"><summary><span>高级筛选</span><small>相关流派、场景、年代、类型与本机状态</small></summary></details>
      </div>
      <p className="r12-catalog-toolbar__note">筛选属于浏览工具，不会改变目录数据。</p>
    </section>
    <AlbumGrid albums={page.items} className="r12-catalog-grid" />
    <StaticPagination pageCount={page.pageCount} />
  </div>;
}

export function TopicCatalogFallback({ albums, kind }: { albums: PublishedAlbumSummary[]; kind: TopicKind }) {
  const filtered = filterTopicAlbums(albums, { decade: null, coreGenre: null, releaseType: null }, "recently-added");
  const page = paginate(filtered, null, CATALOG_PAGE_SIZE);

  return <div className="catalog-geometry-fallback" aria-busy="true" aria-label="正在准备专题目录">
    <div className="topic-filter-bar" aria-hidden="true">
      {kind !== "decade" ? <StaticSelect label="年代" /> : null}
      {kind !== "core" ? <StaticSelect label="核心流派" /> : null}
      <StaticSelect label="发行类型" />
      <StaticSelect label="排序" />
    </div>
    <div className="results-bar" aria-hidden="true"><p>找到 <strong>{filtered.length}</strong> 张专辑 · 当前显示 {page.items.length} 张</p><span>随机发现一张</span></div>
    <AlbumGrid albums={page.items} />
    <StaticPagination pageCount={page.pageCount} />
  </div>;
}
