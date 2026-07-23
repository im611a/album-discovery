"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { buildDiscoverOptions, discoverAlbums, type CatalogSort, type DiscoverFilters } from "@/catalog/queries";
import { getDescriptorLabel, getTaxonomyLabel } from "@/catalog/published-catalog";
import { RELEASE_TYPE_LABELS, type ReleaseType } from "@/catalog/schema";

const options = buildDiscoverOptions();
const sorts: Array<[CatalogSort, string]> = [["recently-added", "最近收录"], ["release-newest", "发行日期：新到旧"], ["release-oldest", "发行日期：旧到新"], ["title", "标题"]];
const releaseTypes = Object.entries(RELEASE_TYPE_LABELS) as Array<[ReleaseType, string]>;
type DiscoverOptions = ReturnType<typeof buildDiscoverOptions>;
type UpdateFilter = (key: string, value: string | boolean) => void;

export function DiscoverFilterFields({
  filterOptions,
  filters,
  sort,
  update,
}: {
  filterOptions: DiscoverOptions;
  filters: DiscoverFilters;
  sort: CatalogSort;
  update: UpdateFilter;
}) {
  return <div className="filter-grid">
    <label>核心流派<select value={filters.coreGenre ?? ""} onChange={(event) => update("genre", event.target.value)}><option value="">全部</option>{filterOptions.coreGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</select></label>
    <label>相关流派<select value={filters.relatedGenre ?? ""} onChange={(event) => update("secondary", event.target.value)}><option value="">全部</option>{filterOptions.relatedGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</select></label>
    <label>氛围与特征<select value={filters.descriptor ?? ""} onChange={(event) => update("descriptor", event.target.value)}><option value="">全部</option>{filterOptions.descriptors.map((value) => <option key={value} value={value}>{getDescriptorLabel(value)}</option>)}</select></label>
    <label>聆听场景（本站策展）<select value={filters.context ?? ""} onChange={(event) => update("context", event.target.value)}><option value="">全部</option>{filterOptions.contexts.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label>年代<select value={filters.decade ?? ""} onChange={(event) => update("decade", event.target.value)}><option value="">全部</option>{filterOptions.decades.map((value) => <option key={value} value={value}>{value.replace("s", " 年代")}</option>)}</select></label>
    <label>发行类型<select value={filters.releaseType ?? ""} onChange={(event) => update("type", event.target.value)}><option value="">全部</option>{releaseTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>排序<select value={sort} onChange={(event) => update("sort", event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="checkbox-label"><input type="checkbox" checked={Boolean(filters.editorialOnly)} onChange={(event) => update("guide", event.target.checked)} />只看有完整导览</label>
  </div>;
}

export function DiscoverCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const getValid = (key: string, values: string[]) => values.includes(params.get(key) ?? "") ? params.get(key) : null;
  const filters: DiscoverFilters = {
    coreGenre: getValid("genre", options.coreGenres), relatedGenre: getValid("secondary", options.relatedGenres), descriptor: getValid("descriptor", options.descriptors), context: getValid("context", options.contexts), decade: getValid("decade", options.decades), releaseType: getValid("type", releaseTypes.map(([value]) => value)) as ReleaseType | null, editorialOnly: params.get("guide") === "1",
  };
  const sort = (sorts.some(([value]) => value === params.get("sort")) ? params.get("sort") : "recently-added") as CatalogSort;
  const results = discoverAlbums(filters, sort);
  function update(key: string, value: string | boolean) { const next = new URLSearchParams(params.toString()); if (!value) next.delete(key); else next.set(key, value === true ? "1" : String(value)); router.push(next.size ? `/discover?${next}` : "/discover", { scroll: false }); }
  return <>
    <details className="filter-panel"><summary>筛选与排序 <span>{Object.values(filters).filter(Boolean).length} 项</span></summary><DiscoverFilterFields filterOptions={options} filters={filters} sort={sort} update={update} /></details>
    <div className="results-bar"><p aria-live="polite">找到 <strong>{results.length}</strong> 张专辑</p>{params.size ? <button type="button" onClick={() => router.push("/discover", { scroll: false })}>清除筛选</button> : null}</div>
    {results.length ? <AlbumGrid albums={results} /> : <div className="empty-state"><h2>当前条件下没有专辑</h2><p>试着减少一个筛选条件，或清除全部筛选。</p></div>}
  </>;
}
