"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function CatalogPagination({ page, pageCount, pathname }: { page: number; pageCount: number; pathname: string }) {
  const router = useRouter();
  const params = useSearchParams();
  if (pageCount <= 1) return null;
  function go(nextPage: number) {
    const next = new URLSearchParams(params.toString());
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    router.push(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }
  return <nav className="catalog-pagination" aria-label="结果分页">
    <button type="button" disabled={page <= 1} onClick={() => go(page - 1)}>上一页</button>
    <p>第 <strong>{page}</strong> / {pageCount} 页</p>
    <button type="button" disabled={page >= pageCount} onClick={() => go(page + 1)}>下一页</button>
  </nav>;
}
