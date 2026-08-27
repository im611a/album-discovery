"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { CatalogPagination } from "@/components/catalog-pagination";
import { Button, Checkbox, FilterGroup, SearchInput, Select } from "@/components/control-primitives";
import { EmptyState } from "@/components/site-primitives";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import { buildCatalogViewModel, parseCatalogQuery, serializeCatalogQuery, type CatalogQueryState, type CatalogUserStatus } from "@/catalog/catalog-view-model";
import { buildDiscoverOptions, type CatalogSort, type DiscoverFilters } from "@/catalog/queries";
import { catalogAlbums, getTaxonomyLabel } from "@/catalog/published-catalog";
import { getListeningSceneLabel } from "@/catalog/listening-scenes";
import { RELEASE_TYPE_LABELS, type ReleaseType } from "@/catalog/schema";
import { CATALOG_PAGE_SIZE, paginate } from "@/catalog/pagination";

const options = buildDiscoverOptions(catalogAlbums);
const sorts: Array<[CatalogSort, string]> = [["recently-added", "最近收录"], ["release-newest", "发行时间：新→旧"], ["release-oldest", "发行时间：旧→新"], ["random", "随机发现"]];
const releaseTypes = Object.entries(RELEASE_TYPE_LABELS) as Array<[ReleaseType, string]>;
const statuses: Array<[CatalogUserStatus, string]> = [["liked", "喜欢"], ["favorite", "收藏"], ["saved", "想听"], ["listened", "听过"], ["dismissed", "不适合"]];

type FilterKey = keyof DiscoverFilters;

function CatalogSearchForm({ initialQuery, onSubmit }: { initialQuery: string; onSubmit: (value: string) => void }) {
  const [draft, setDraft] = useState(initialQuery);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draft.trim());
  }
  return <form className="catalog-search-form" role="search" onSubmit={submit}><label htmlFor="catalog-query">搜索专辑或艺人</label><div><SearchInput id="catalog-query" value={draft} onChange={(event) => setDraft(event.target.value)} /><Button className="button--primary" type="submit">搜索</Button></div></form>;
}

export function DiscoverFilterFields({ query, updateFilter, updateStatus, updateSort }: { query: CatalogQueryState; updateFilter: (key: FilterKey, value: string | boolean) => void; updateStatus: (value: string) => void; updateSort: (value: CatalogSort) => void }) {
  const filters = query.filters;
  return <>
  <div className="filter-grid filter-grid--primary" aria-label="主要目录筛选">
    <FilterGroup label="核心流派"><Select aria-label="核心流派" value={filters.coreGenre ?? ""} onChange={(event) => updateFilter("coreGenre", event.target.value)}><option value="">全部</option>{options.coreGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</Select></FilterGroup>
    <FilterGroup label="排序"><Select aria-label="排序" value={sorts.some(([value]) => value === query.sort) ? query.sort : "recently-added"} onChange={(event) => updateSort(event.target.value as CatalogSort)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FilterGroup>
  </div>
  <details className="catalog-advanced-filters">
    <summary><span>高级筛选</span><small>相关流派、场景、年代、类型与本机状态</small></summary>
    <div className="filter-grid filter-grid--advanced" aria-label="高级目录筛选">
    <FilterGroup label="相关流派"><Select aria-label="相关流派" value={filters.relatedGenre ?? ""} onChange={(event) => updateFilter("relatedGenre", event.target.value)}><option value="">全部</option>{options.relatedGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</Select></FilterGroup>
    <FilterGroup label="聆听场景" hint=" · 本站策展维度"><Select aria-label="聆听场景" value={filters.context ?? ""} onChange={(event) => updateFilter("context", event.target.value)}><option value="">全部</option>{options.contexts.map((value) => <option key={value} value={value}>{getListeningSceneLabel(value)}</option>)}</Select></FilterGroup>
    <FilterGroup label="年代"><Select aria-label="年代" value={filters.decade ?? ""} onChange={(event) => updateFilter("decade", event.target.value)}><option value="">全部</option>{options.decades.map((value) => <option key={value} value={value}>{value.replace("s", " 年代")}</option>)}</Select></FilterGroup>
    <FilterGroup label="发行类型"><Select aria-label="发行类型" value={filters.releaseType ?? ""} onChange={(event) => updateFilter("releaseType", event.target.value)}><option value="">全部</option>{releaseTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FilterGroup>
    <FilterGroup label="本机状态"><Select aria-label="本机状态" value={query.userStatus ?? ""} onChange={(event) => updateStatus(event.target.value)}><option value="">全部</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FilterGroup>
    <label className="checkbox-label"><Checkbox checked={Boolean(filters.editorialOnly)} onChange={(event) => updateFilter("editorialOnly", event.target.checked)} />只看有完整导览</label>
    </div>
  </details>
  </>;
}

export function DiscoverCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated } = usePersonalState();
  const query = parseCatalogQuery(params, catalogAlbums);
  const model = buildCatalogViewModel({ albums: catalogAlbums, query, userState: hydrated ? state : null });
  const page = paginate(model.albums, params.get("page"), CATALOG_PAGE_SIZE);

  function navigate(next: CatalogQueryState, requestedPage?: number) {
    const nextParams = new URLSearchParams(serializeCatalogQuery(next));
    if (requestedPage && requestedPage > 1) nextParams.set("page", String(requestedPage));
    router.push(nextParams.size ? `/discover?${nextParams}` : "/discover", { scroll: false });
  }
  function updateFilter(key: FilterKey, value: string | boolean) {
    navigate({ ...query, filters: { ...query.filters, [key]: typeof value === "boolean" ? value : value || null } });
  }
  const activeFilters = [
    query.query ? { key: "query", label: `搜索：${query.query}`, clear: () => navigate({ ...query, query: "" }) } : null,
    query.filters.coreGenre ? { key: "core", label: `核心流派：${getTaxonomyLabel(query.filters.coreGenre)}`, clear: () => updateFilter("coreGenre", "") } : null,
    query.filters.relatedGenre ? { key: "related", label: `相关流派：${getTaxonomyLabel(query.filters.relatedGenre)}`, clear: () => updateFilter("relatedGenre", "") } : null,
    query.filters.context ? { key: "scene", label: `聆听场景：${getListeningSceneLabel(query.filters.context)}`, clear: () => updateFilter("context", "") } : null,
    query.filters.decade ? { key: "decade", label: `年代：${query.filters.decade.replace("s", " 年代")}`, clear: () => updateFilter("decade", "") } : null,
    query.filters.releaseType ? { key: "type", label: `发行类型：${RELEASE_TYPE_LABELS[query.filters.releaseType]}`, clear: () => updateFilter("releaseType", "") } : null,
    query.filters.editorialOnly ? { key: "editorial", label: "有完整导览", clear: () => updateFilter("editorialOnly", false) } : null,
    query.userStatus ? { key: "status", label: `本机状态：${statuses.find(([value]) => value === query.userStatus)?.[1]}`, clear: () => navigate({ ...query, userStatus: null }) } : null,
  ].filter((item): item is { key: string; label: string; clear: () => void } => Boolean(item));
  const activeCount = Object.values(query.filters).filter(Boolean).length + Number(Boolean(query.userStatus)) + Number(Boolean(query.query));
  return <>
    <section className="r12-catalog-toolbar" aria-labelledby="catalog-tools-title">
      <div className="r12-catalog-toolbar__status">
        <div><p className="section-kicker">浏览结果</p><h2 id="catalog-tools-title">{model.resultCount} 张专辑</h2></div>
        <p aria-live="polite">第 {page.page} / {page.pageCount} 页 · 当前显示 {page.items.length} 张</p>
        {params.size ? <button type="button" onClick={() => router.push("/discover", { scroll: false })}>清除全部</button> : null}
      </div>
      <div className="r12-catalog-toolbar__primary">
        <CatalogSearchForm key={query.query} initialQuery={query.query} onSubmit={(value) => navigate({ ...query, query: value })} />
        <DiscoverFilterFields query={query} updateFilter={updateFilter} updateStatus={(value) => navigate({ ...query, userStatus: value ? value as CatalogUserStatus : null })} updateSort={(value) => navigate({ ...query, sort: value })} />
      </div>
      <p className="r12-catalog-toolbar__note">{activeCount ? `${activeCount} 项条件已启用；网址会保存当前浏览状态。` : "筛选属于浏览工具，不会改变目录数据。"}</p>
    </section>
    {activeFilters.length ? <div className="active-filters" aria-label="当前筛选">{activeFilters.map((item) => <button key={item.key} type="button" onClick={item.clear}>{item.label}<span aria-hidden="true">×</span></button>)}</div> : null}
    {model.empty ? <EmptyState title="当前条件下没有专辑">{model.emptyMessage}</EmptyState> : <AlbumGrid albums={page.items} className="r12-catalog-grid" />}
    <CatalogPagination page={page.page} pageCount={page.pageCount} pathname="/discover" />
  </>;
}
