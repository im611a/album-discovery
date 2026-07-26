"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { AlbumGrid } from "@/components/album-grid";
import { buildDiscoverOptions, discoverAlbums, type CatalogSort, type DiscoverFilters } from "@/catalog/queries";
import { catalogAlbums, getTaxonomyLabel } from "@/catalog/published-catalog";
import { getListeningSceneLabel } from "@/catalog/listening-scenes";
import { RELEASE_TYPE_LABELS, type ReleaseType } from "@/catalog/schema";
import { CATALOG_PAGE_SIZE, paginate } from "@/catalog/pagination";
import { CatalogPagination } from "@/components/catalog-pagination";

const options = buildDiscoverOptions();
const sorts: Array<[CatalogSort, string]> = [["recently-added", "最近收录"], ["release-newest", "发行日期：新到旧"], ["release-oldest", "发行日期：旧到新"], ["title", "标题"], ["rym-rating-desc", "RYM 评分：由高到低"]];
const releaseTypes = Object.entries(RELEASE_TYPE_LABELS) as Array<[ReleaseType, string]>;
const hasRymRatings = catalogAlbums.some((album) => album.rymRating != null);
type DiscoverOptions = ReturnType<typeof buildDiscoverOptions>;
type UpdateFilter = (key: string, value: string | boolean) => void;

function DiscoverFilterDialog({
  activeCount,
  sortLabel,
  children,
}: {
  activeCount: number;
  sortLabel: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="pa-discover-filter__trigger" type="button">
          <span>筛选馆藏</span>
          <small>{activeCount} 项已选 · {sortLabel}</small>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="pa-discover-filter__overlay" />
        <Dialog.Content className="pa-discover-filter__content">
          <header className="pa-discover-filter__header">
            <div>
              <p>馆藏索引</p>
              <Dialog.Title>筛选与排序</Dialog.Title>
              <Dialog.Description className="pa-discover-filter__description">
                选择真实存在于本地目录的分类；变更会同步到当前网址。
              </Dialog.Description>
            </div>
            <Dialog.Close className="pa-discover-filter__close" aria-label="关闭筛选面板">
              关闭
            </Dialog.Close>
          </header>
          <div className="pa-discover-filter__body">
            {children}
          </div>
          <Dialog.Close className="pa-discover-filter__done">查看当前结果</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
    <label>核心流派<select aria-label="核心流派" value={filters.coreGenre ?? ""} onChange={(event) => update("genre", event.target.value)}><option value="">全部</option>{filterOptions.coreGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</select></label>
    <label>相关流派<select aria-label="相关流派" aria-describedby={!filterOptions.relatedGenres.length ? "related-genre-unavailable" : undefined} disabled={!filterOptions.relatedGenres.length} value={filters.relatedGenre ?? ""} onChange={(event) => update("secondary", event.target.value)}>{filterOptions.relatedGenres.length ? <option value="">全部</option> : <option value="">暂无已核验数据</option>}{filterOptions.relatedGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</select>{!filterOptions.relatedGenres.length ? <small id="related-genre-unavailable">导入可靠 RYM Secondary Genres 后自动启用。</small> : null}</label>
    <label>聆听场景 <span className="field-provenance">本站策展维度</span><select aria-label="聆听场景" value={filters.context ?? ""} onChange={(event) => update("context", event.target.value)}><option value="">全部</option>{filterOptions.contexts.map((value) => <option key={value} value={value}>{getListeningSceneLabel(value)}</option>)}</select></label>
    <label>年代<select aria-label="年代" value={filters.decade ?? ""} onChange={(event) => update("decade", event.target.value)}><option value="">全部</option>{filterOptions.decades.map((value) => <option key={value} value={value}>{value.replace("s", " 年代")}</option>)}</select></label>
    <label>发行类型<select aria-label="发行类型" value={filters.releaseType ?? ""} onChange={(event) => update("type", event.target.value)}><option value="">全部</option>{releaseTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>排序<select aria-label="排序" value={sort} onChange={(event) => update("sort", event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value} disabled={value === "rym-rating-desc" && !hasRymRatings}>{value === "rym-rating-desc" && !hasRymRatings ? "RYM 评分：暂无已核验评分" : label}</option>)}</select>{!hasRymRatings ? <small>导入首条可靠评分后自动启用。</small> : null}</label>
    <label className="checkbox-label"><input type="checkbox" checked={Boolean(filters.editorialOnly)} onChange={(event) => update("guide", event.target.checked)} />只看有完整导览</label>
  </div>;
}

export function DiscoverCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const getValid = (key: string, values: string[]) => values.includes(params.get(key) ?? "") ? params.get(key) : null;
  const filters: DiscoverFilters = {
    coreGenre: getValid("genre", options.coreGenres), relatedGenre: getValid("secondary", options.relatedGenres), context: getValid("context", options.contexts), decade: getValid("decade", options.decades), releaseType: getValid("type", releaseTypes.map(([value]) => value)) as ReleaseType | null, editorialOnly: params.get("guide") === "1",
  };
  const requestedSort = params.get("sort");
  const sort = (sorts.some(([value]) => value === requestedSort) && (requestedSort !== "rym-rating-desc" || hasRymRatings) ? requestedSort : "recently-added") as CatalogSort;
  const results = discoverAlbums(filters, sort);
  const page = paginate(results, params.get("page"), CATALOG_PAGE_SIZE);
  function update(key: string, value: string | boolean) { const next = new URLSearchParams(params.toString()); next.delete("page"); if (!value) next.delete(key); else next.set(key, value === true ? "1" : String(value)); router.push(next.size ? `/discover?${next}` : "/discover", { scroll: false }); }
  const active = [
    filters.coreGenre ? ["genre", getTaxonomyLabel(filters.coreGenre)] : null,
    filters.relatedGenre ? ["secondary", getTaxonomyLabel(filters.relatedGenre)] : null,
    filters.context ? ["context", getListeningSceneLabel(filters.context)] : null,
    filters.decade ? ["decade", filters.decade.replace("s", " 年代")] : null,
    filters.releaseType ? ["type", RELEASE_TYPE_LABELS[filters.releaseType]] : null,
    filters.editorialOnly ? ["guide", "有完整导览"] : null,
  ].filter(Boolean) as string[][];
  const sortLabel = sorts.find(([value]) => value === sort)?.[1] ?? "最近收录";
  return <>
    <DiscoverFilterDialog activeCount={active.length} sortLabel={sortLabel}>
      <DiscoverFilterFields filterOptions={options} filters={filters} sort={sort} update={update} />
    </DiscoverFilterDialog>
    {active.length ? <div className="active-filters" aria-label="当前筛选">{active.map(([key, label]) => <button key={key} type="button" onClick={() => update(key, "")}>{label}<span aria-hidden="true">×</span><span className="visually-hidden">移除此筛选</span></button>)}</div> : null}
    <div className="results-bar"><p aria-live="polite">找到 <strong>{results.length}</strong> 张专辑 · 当前显示 {page.items.length} 张</p>{params.size ? <button type="button" onClick={() => router.push("/discover", { scroll: false })}>清除全部</button> : null}</div>
    {results.length ? <AlbumGrid albums={page.items} /> : <div className="empty-state"><h2>当前条件下没有专辑</h2><p>试着减少一个筛选条件，或清除全部筛选。</p></div>}
    <CatalogPagination page={page.page} pageCount={page.pageCount} pathname="/discover" />
  </>;
}
