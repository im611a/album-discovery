"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AlbumGrid } from "@/components/album-grid";
import type { MockAlbum } from "@/data/albums.mock";
import type {
  MarketChannel,
  MockNewReleaseSourceContext,
} from "@/data/new-releases.mock";
import {
  DEFAULT_NEW_RELEASE_STATE,
  getMarketChannelLabel,
  NEW_RELEASE_TYPE_OPTIONS,
  parseNewReleaseQuery,
  selectNewReleaseAlbums,
  serializeNewReleaseState,
  type NewReleaseState,
  type NewReleaseTypeValue,
} from "@/lib/new-releases";

import { MarketChannelFilter } from "./market-channel-filter";

type NewReleasesCatalogProps = {
  albums: MockAlbum[];
  sources: MockNewReleaseSourceContext[];
};

export function NewReleasesCatalog({ albums, sources }: NewReleasesCatalogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(() => parseNewReleaseQuery(searchParams), [searchParams]);
  const results = useMemo(
    () => selectNewReleaseAlbums(albums, sources, state),
    [albums, sources, state],
  );
  const channelLabel = getMarketChannelLabel(state.channel);

  function navigate(nextState: NewReleaseState) {
    const query = serializeNewReleaseState(nextState);
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function selectChannel(channel: MarketChannel) {
    navigate({ ...state, channel });
  }

  function selectReleaseType(releaseType: NewReleaseTypeValue) {
    navigate({ ...state, releaseType });
  }

  return (
    <div className="new-releases-catalog">
      <section
        aria-labelledby="new-release-filter-heading"
        className="new-releases-filter-panel"
      >
        <div className="new-releases-filter-panel__heading">
          <div>
            <p className="eyebrow">来源列表</p>
            <h2 id="new-release-filter-heading">网易云市场频道</h2>
          </div>
        </div>

        <MarketChannelFilter
          selectedChannel={state.channel}
          onSelect={selectChannel}
        />

        <div className="new-releases-type-filter">
          <label htmlFor="new-release-type-filter">发行类型</label>
          <select
            id="new-release-type-filter"
            onChange={(event) =>
              selectReleaseType(event.target.value as NewReleaseTypeValue)
            }
            value={state.releaseType}
          >
            {NEW_RELEASE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <p className="market-channel-note">
          市场频道是发现来源，不代表专辑或艺术家的国籍、语言、法域或真实地区。
        </p>
      </section>

      <section className="new-releases-results" aria-labelledby="new-release-results">
        <div className="new-releases-results__heading">
          <div>
            <p className="eyebrow">新发行列表</p>
            <h2 id="new-release-results">
              {channelLabel} · <strong>{results.length}</strong> 张专辑
            </h2>
          </div>
        </div>

        {results.length > 0 ? (
          <AlbumGrid albums={results} />
        ) : (
          <div className="new-releases-empty-state" role="status">
            <h3>当前条件下没有新发行专辑</h3>
            <p>可以调整市场频道或发行类型后重新浏览。</p>
            <div className="new-releases-empty-state__actions">
              {state.releaseType !== DEFAULT_NEW_RELEASE_STATE.releaseType ? (
                <button
                  className="secondary-button"
                  onClick={() => selectReleaseType("all")}
                  type="button"
                >
                  清除类型筛选
                </button>
              ) : null}
              {state.channel !== DEFAULT_NEW_RELEASE_STATE.channel ? (
                <button
                  className="secondary-button"
                  onClick={() => selectChannel("ALL")}
                  type="button"
                >
                  查看全部频道
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
