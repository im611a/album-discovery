import {
  DECADE_OPTIONS,
  RELEASE_TYPE_OPTIONS,
  SORT_OPTIONS,
  type DiscoverOptions,
  type DiscoverState,
  type ReleaseTypeValue,
  type SortValue,
  type DecadeValue,
} from "@/lib/album-filters";
import { getDisplayLabel } from "@/lib/display-labels";

type DiscoverFiltersProps = {
  activeFilterCount: number;
  options: DiscoverOptions;
  state: DiscoverState;
  onChange: (nextState: DiscoverState) => void;
};

export function DiscoverFilters({
  activeFilterCount,
  options,
  state,
  onChange,
}: DiscoverFiltersProps) {
  function updateState(patch: Partial<DiscoverState>) {
    onChange({ ...state, ...patch });
  }

  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === state.sort)?.label ?? "最新发行";

  return (
    <section className="discover-filter-panel" aria-labelledby="filter-heading">
      <div className="discover-filter-panel__heading">
        <div>
          <p className="eyebrow">浏览条件</p>
          <h2 id="filter-heading">筛选与排序</h2>
        </div>
        <p>选择会保存到当前页面地址。</p>
      </div>

      <details className="primary-filters">
        <summary
          aria-controls="primary-filter-controls"
          className="primary-filters__summary"
        >
          <span>筛选与排序</span>
          <span className="primary-filters__summary-meta">
            <span>{activeFilterCount} 项筛选</span>
            <span>{sortLabel}</span>
          </span>
        </summary>
      </details>

      <div
        className="discover-filter-grid primary-filters__content"
        id="primary-filter-controls"
      >
          <label className="filter-field" htmlFor="decade-filter">
            <span>年代</span>
            <select
              id="decade-filter"
              onChange={(event) =>
                updateState({ decade: event.target.value as DecadeValue })
              }
              value={state.decade}
            >
              {DECADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field" htmlFor="release-type-filter">
            <span>发行类型</span>
            <select
              id="release-type-filter"
              onChange={(event) =>
                updateState({ releaseType: event.target.value as ReleaseTypeValue })
              }
              value={state.releaseType}
            >
              {RELEASE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {getDisplayLabel(option.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field" htmlFor="primary-genre-filter">
            <span>主流派</span>
            <select
              id="primary-genre-filter"
              onChange={(event) =>
                updateState({ primaryGenre: event.target.value || null })
              }
              value={state.primaryGenre ?? ""}
            >
              <option value="">全部主流派</option>
              {options.primaryGenres.map((option) => (
                <option key={option.value} value={option.value}>
                  {getDisplayLabel(option.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field filter-field--sort" htmlFor="sort-filter">
            <span>排序</span>
            <select
              id="sort-filter"
              onChange={(event) =>
                updateState({ sort: event.target.value as SortValue })
              }
              value={state.sort}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
      </div>

      <details className="more-filters">
        <summary>
          <span>更多筛选</span>
          <span className="more-filters__state" aria-hidden="true">
            <span className="more-filters__expand">展开</span>
            <span className="more-filters__collapse">收起</span>
          </span>
        </summary>
        <div className="more-filters__content">
          <label className="filter-field" htmlFor="secondary-genre-filter">
            <span>次要流派</span>
            <select
              id="secondary-genre-filter"
              onChange={(event) =>
                updateState({ secondaryGenre: event.target.value || null })
              }
              value={state.secondaryGenre ?? ""}
            >
              <option value="">全部次级流派</option>
              {options.secondaryGenres.map((option) => (
                <option key={option.value} value={option.value}>
                  {getDisplayLabel(option.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field" htmlFor="descriptor-filter">
            <span>描述标签</span>
            <select
              id="descriptor-filter"
              onChange={(event) =>
                updateState({ descriptor: event.target.value || null })
              }
              value={state.descriptor ?? ""}
            >
              <option value="">全部描述词</option>
              {options.descriptors.map((option) => (
                <option key={option.value} value={option.value}>
                  {getDisplayLabel(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
