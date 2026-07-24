"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { CatalogPagination } from "@/components/catalog-pagination";
import { buildDiscoverOptions, type CatalogSort } from "@/catalog/queries";
import { CATALOG_PAGE_SIZE, paginate } from "@/catalog/pagination";
import { deterministicTopicAlbum, filterTopicAlbums, type TopicKind } from "@/catalog/topics";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { RELEASE_TYPE_LABELS, type PublishedAlbumSummary, type ReleaseType } from "@/catalog/schema";

const sorts: Array<[CatalogSort, string]> = [
  ["recently-added", "最近收录"],
  ["rym-rating-desc", "RYM 评分：由高到低"],
  ["release-newest", "发行日期：新到旧"],
];

export function TopicCatalog({ albums, kind, topicKey, pathname }: { albums: PublishedAlbumSummary[]; kind: TopicKind; topicKey: string; pathname: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const options = buildDiscoverOptions(albums);
  const decade = options.decades.includes(params.get("decade") ?? "") ? params.get("decade") : null;
  const coreGenre = options.coreGenres.includes(params.get("genre") ?? "") ? params.get("genre") : null;
  const releaseType = Object.hasOwn(RELEASE_TYPE_LABELS, params.get("type") ?? "") ? params.get("type") as ReleaseType : null;
  const requestedSort = params.get("sort");
  const sort = sorts.some(([value]) => value === requestedSort) ? requestedSort as CatalogSort : "recently-added";
  const filtered = filterTopicAlbums(albums, {
    decade: kind === "decade" ? null : decade,
    coreGenre: kind === "core" ? null : coreGenre,
    releaseType,
  }, sort);
  const slice = paginate(filtered, params.get("page"), CATALOG_PAGE_SIZE);
  const random = deterministicTopicAlbum(filtered, `${kind}:${topicKey}:${params.get("seed") ?? "default"}`);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value) next.set(key, value); else next.delete(key);
    router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }
  return <>
    <div className="topic-filter-bar">
      {kind !== "decade" ? <label>年代<select value={decade ?? ""} onChange={(event) => update("decade", event.target.value)}><option value="">全部</option>{options.decades.map((value) => <option key={value} value={value}>{value.replace("s", " 年代")}</option>)}</select></label> : null}
      {kind !== "core" ? <label>核心流派<select value={coreGenre ?? ""} onChange={(event) => update("genre", event.target.value)}><option value="">全部</option>{options.coreGenres.map((value) => <option key={value} value={value}>{getTaxonomyLabel(value)}</option>)}</select></label> : null}
      <label>发行类型<select value={releaseType ?? ""} onChange={(event) => update("type", event.target.value)}><option value="">全部</option>{Object.entries(RELEASE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>排序<select value={sort} onChange={(event) => update("sort", event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="results-bar"><p>找到 <strong>{filtered.length}</strong> 张专辑 · 当前显示 {slice.items.length} 张</p>{random ? <Link href={`/albums/${random.slug}`}>随机发现一张</Link> : null}</div>
    {slice.items.length ? <AlbumGrid albums={slice.items} /> : <div className="empty-state"><h2>当前条件下没有专辑</h2><p>尝试清除一个筛选条件。</p></div>}
    <CatalogPagination page={slice.page} pageCount={slice.pageCount} pathname={pathname} />
  </>;
}
