import {
  LIBRARY_SORTS,
  LIBRARY_VIEWS,
  MAX_LIBRARY_QUERY_LENGTH,
  type LibrarySort,
  type LibraryView,
} from "./collection-presentation";

export const NAVIGATION_ORIGIN_KEYS = ["lfrom", "lview", "lq", "lsort", "sfrom", "sq", "spage"] as const;
export const MAX_RETURN_URL_LENGTH = 512;
const MAX_SEARCH_PAGE = 10_000;

export type NavigationOrigin =
  | Readonly<{ kind: "LIBRARY"; view: LibraryView; query: string; sort: LibrarySort }>
  | Readonly<{ kind: "SEARCH"; query: string; page: number }>
  | Readonly<{ kind: "NONE" }>;

function boundedText(value: string | null) {
  return (value ?? "").trim().slice(0, MAX_LIBRARY_QUERY_LENGTH);
}

function accepted<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? value as T : fallback;
}

function acceptedPage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_SEARCH_PAGE ? parsed : 1;
}

export function parseNavigationOrigin(input: string | URLSearchParams): NavigationOrigin {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const library = params.get("lfrom") === "library";
  const search = params.get("sfrom") === "search";
  if (library === search) return Object.freeze({ kind: "NONE" });
  if (library) {
    return Object.freeze({
      kind: "LIBRARY",
      view: accepted(params.get("lview"), LIBRARY_VIEWS, "overview"),
      query: boundedText(params.get("lq")),
      sort: accepted(params.get("lsort"), LIBRARY_SORTS, "catalog"),
    });
  }
  return Object.freeze({
    kind: "SEARCH",
    query: boundedText(params.get("sq")),
    page: acceptedPage(params.get("spage")),
  });
}

export function serializeNavigationOrigin(origin: NavigationOrigin) {
  const params = new URLSearchParams();
  if (origin.kind === "LIBRARY") {
    params.set("lfrom", "library");
    if (origin.view !== "overview") params.set("lview", origin.view);
    if (origin.query) params.set("lq", origin.query);
    if (origin.sort !== "catalog") params.set("lsort", origin.sort);
  } else if (origin.kind === "SEARCH") {
    params.set("sfrom", "search");
    if (origin.query) params.set("sq", origin.query);
    if (origin.page !== 1) params.set("spage", String(origin.page));
  }
  return params;
}

export function appendNavigationOrigin(href: string, input: string | URLSearchParams | NavigationOrigin) {
  const origin = typeof input === "object" && "kind" in input ? input : parseNavigationOrigin(input);
  if (origin.kind === "NONE") return href;
  const [fragmentless, fragment = ""] = href.split("#", 2);
  const [pathname, query = ""] = fragmentless.split("?", 2);
  const params = new URLSearchParams(query);
  for (const key of NAVIGATION_ORIGIN_KEYS) params.delete(key);
  serializeNavigationOrigin(origin).forEach((value, key) => params.set(key, value));
  const result = `${pathname}${params.size ? `?${params}` : ""}${fragment ? `#${fragment}` : ""}`;
  return result.length <= MAX_RETURN_URL_LENGTH ? result : href;
}

export function buildSearchOriginHref(href: string, query: string, page: number) {
  return appendNavigationOrigin(href, Object.freeze({ kind: "SEARCH", query: boundedText(query), page: acceptedPage(String(page)) }));
}

export function buildNavigationReturnHref(origin: NavigationOrigin) {
  if (origin.kind === "LIBRARY") {
    const params = new URLSearchParams();
    if (origin.view !== "overview") params.set("view", origin.view);
    if (origin.query) params.set("q", origin.query);
    if (origin.sort !== "catalog") params.set("sort", origin.sort);
    return `/library${params.size ? `?${params}` : ""}`;
  }
  if (origin.kind === "SEARCH") {
    const params = new URLSearchParams();
    if (origin.query) params.set("q", origin.query);
    if (origin.page !== 1) params.set("page", String(origin.page));
    return `/search${params.size ? `?${params}` : ""}`;
  }
  return null;
}
