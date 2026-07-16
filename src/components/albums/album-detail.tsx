import Link from "next/link";

import type { MockAlbumDetail } from "@/data/album-details.mock";
import type { MockAlbum } from "@/data/albums.mock";
import {
  getDiscoverTaxonomyHref,
  type TaxonomyKind,
} from "@/lib/album-filters";
import {
  formatRatingCount,
  formatReleaseDate,
} from "@/lib/album-details";
import { formatArtists } from "@/lib/albums";
import { getDisplayLabel } from "@/lib/display-labels";

import { AlbumCover } from "./album-cover";
import { TrackList } from "./track-list";

type AlbumDetailProps = {
  album: MockAlbum;
  detail: MockAlbumDetail;
};

type TaxonomyGroup = {
  id: string;
  kind: TaxonomyKind;
  labels: string[];
  title: string;
};

export function AlbumDetail({ album, detail }: AlbumDetailProps) {
  const taxonomyGroups: TaxonomyGroup[] = [
    {
      id: "primary-genres",
      kind: "primaryGenre",
      labels: album.primaryGenres,
      title: "主流派",
    },
    {
      id: "secondary-genres",
      kind: "secondaryGenre",
      labels: album.secondaryGenres,
      title: "次要流派",
    },
    {
      id: "descriptors",
      kind: "descriptor",
      labels: album.descriptors,
      title: "描述标签",
    },
  ];

  return (
    <>
      <section className="album-hero" aria-labelledby="album-title">
        <div className="album-hero__cover">
          <AlbumCover album={album} size="detail" />
        </div>
        <div className="album-hero__content">
          <p className="eyebrow">本地虚构专辑详情</p>
          <h1 id="album-title">{album.title}</h1>
          {album.aliases.length > 0 ? (
            <p className="album-hero__aliases">{album.aliases.join(" / ")}</p>
          ) : null}
          <p className="album-hero__artists">{formatArtists(album.artists)}</p>
          <dl className="album-metadata">
            <div>
              <dt>发行日期</dt>
              <dd>
                <time dateTime={album.releaseDate}>
                  {formatReleaseDate(album.releaseDate)}
                </time>
              </dd>
            </div>
            <div>
              <dt>发行类型</dt>
              <dd>{getDisplayLabel(album.releaseType)}</dd>
            </div>
            {detail.company ? (
              <div>
                <dt>发行公司</dt>
                <dd>{detail.company}</dd>
              </div>
            ) : null}
            <div>
              <dt>曲目数量</dt>
              <dd>{detail.tracks.length} 首</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="album-listening" aria-labelledby="listening-title">
        <div>
          <p className="eyebrow">唯一外部收听入口</p>
          <h2 id="listening-title">网易云音乐</h2>
          <p>本阶段不使用真实专辑链接，也不会发起外部请求。</p>
        </div>
        <span aria-disabled="true" className="netease-entry" role="link">
          <span>在网易云音乐中查看</span>
          <small>真实数据接入后启用</small>
        </span>
      </section>

      <div className="album-detail-grid">
        <section
          className="album-detail-panel album-taxonomy"
          aria-labelledby="taxonomy-title"
        >
          <p className="eyebrow">RYM 分类</p>
          <h2 id="taxonomy-title">流派与描述</h2>
          <div className="album-taxonomy__groups">
            {taxonomyGroups.map((group) => (
              <section aria-labelledby={group.id} key={group.kind}>
                <h3 id={group.id}>{group.title}</h3>
                <ul>
                  {group.labels.map((label) => (
                    <li key={label}>
                      <Link href={getDiscoverTaxonomyHref(group.kind, label)}>
                        {getDisplayLabel(label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="album-detail-panel album-rating" aria-labelledby="rating-title">
          <p className="eyebrow">社区评价</p>
          <h2 id="rating-title">RYM 社区评分</h2>
          {album.rymScore !== null && album.rymRatingCount !== null ? (
            <div className="album-rating__value">
              <strong>{album.rymScore.toFixed(2)} / 5</strong>
              <span>{formatRatingCount(album.rymRatingCount)} 人评分</span>
            </div>
          ) : (
            <p className="album-rating__missing">暂无 RYM 评分</p>
          )}
          <p className="album-detail-note">当前评分与人数均为本地虚构原型数据。</p>
        </section>
      </div>

      <section className="album-detail-panel album-tracks" aria-labelledby="tracks-title">
        <div className="album-detail-panel__heading">
          <div>
            <p className="eyebrow">完整曲序</p>
            <h2 id="tracks-title">曲目表</h2>
          </div>
          <span>{detail.tracks.length} 首</span>
        </div>
        <TrackList albumArtists={album.artists} tracks={detail.tracks} />
      </section>

      <section className="album-sources" aria-labelledby="sources-title">
        <h2 id="sources-title">数据来源说明</h2>
        <p>
          当前内容为本地虚构原型数据，不代表任何真实专辑、评分或曲目。
          未来专辑目录数据计划由网易云同步层提供，评分与分类数据计划通过 RYM
          离线导入层提供；当前页面不会实时连接这些来源。
        </p>
      </section>
    </>
  );
}
