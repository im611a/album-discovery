"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AlbumGrid } from "@/components/album-grid";
import type { MockAlbum } from "@/data/albums.mock";
import {
  DEFAULT_DISCOVER_STATE,
  buildDiscoverOptions,
  filterAndSortAlbums,
  getActiveFilters,
  parseDiscoverQuery,
  removeFilter,
  serializeDiscoverState,
  type DiscoverState,
  type FilterKey,
} from "@/lib/album-filters";

import { DiscoverFilters } from "./discover-filters";

type DiscoverCatalogProps = {
  albums: MockAlbum[];
};

export function DiscoverCatalog({ albums }: DiscoverCatalogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const options = useMemo(() => buildDiscoverOptions(albums), [albums]);
  const state = useMemo(
    () => parseDiscoverQuery(searchParams, options),
    [options, searchParams],
  );
  const results = useMemo(
    () => filterAndSortAlbums(albums, state, options),
    [albums, options, state],
  );
  const activeFilters = getActiveFilters(state, options);

  function navigate(nextState: DiscoverState) {
    const query = serializeDiscoverState(nextState);
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function removeActiveFilter(key: FilterKey) {
    navigate(removeFilter(state, key));
  }

  function clearAll() {
    navigate(DEFAULT_DISCOVER_STATE);
  }

  return (
    <div className="discover-catalog">
      <DiscoverFilters options={options} state={state} onChange={navigate} />

      <section className="discover-results" aria-labelledby="results-heading">
        <div className="discover-results__heading">
          <div>
            <h2 id="results-heading">专辑结果</h2>
            <p aria-live="polite">
              <strong>{results.length}</strong> 张专辑
            </p>
          </div>
        </div>

        {activeFilters.length > 0 ? (
          <div className="active-filters" aria-label="当前筛选条件">
            <span className="active-filters__label">当前筛选</span>
            <ul>
              {activeFilters.map((filter) => (
                <li key={filter.key}>
                  <button
                    aria-label={`移除筛选：${filter.label}`}
                    onClick={() => removeActiveFilter(filter.key)}
                    type="button"
                  >
                    <span>{filter.label}</span>
                    <span aria-hidden="true">移除</span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="clear-filter-button" onClick={clearAll} type="button">
              清除全部
            </button>
          </div>
        ) : null}

        {results.length > 0 ? (
          <AlbumGrid albums={results} />
        ) : (
          <div className="discover-empty-state" role="status">
            <h3>没有找到符合条件的专辑</h3>
            <p>可以调整筛选条件，或清除筛选后重新浏览。</p>
            <button className="secondary-button" onClick={clearAll} type="button">
              清除筛选
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
