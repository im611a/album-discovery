export const CATALOG_PAGE_SIZE = 48;
export const SEARCH_PAGE_SIZE = 40;

export interface PageSlice<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

export function normalizePage(value: string | null, pageCount: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(1, pageCount));
}

export function paginate<T>(items: T[], requestedPage: string | null, pageSize: number): PageSlice<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = normalizePage(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageCount, total: items.length };
}
