import Link from "next/link";
import { getDescriptorLabel, getTaxonomyLabel } from "@/catalog/published-catalog";
import { formatPartialDate, RELEASE_TYPE_LABELS, type PublishedAlbum } from "@/catalog/schema";
import { AlbumCover } from "./album-cover";
import { AlbumDetailActions } from "./album-detail-actions";
import { TrackList } from "./track-list";

export function AlbumDetail({ album }: { album: PublishedAlbum }) {
  const totalDuration = album.tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
  const hasRymTaxonomy = album.relatedGenres.length > 0 || album.descriptors.length > 0;
  return <article className="album-detail">
    <nav className="breadcrumbs" aria-label="面包屑"><Link href="/discover">发现</Link><span aria-hidden="true">/</span><span>{album.title}</span></nav>
    <header className="album-detail__hero">
      <AlbumCover album={album} size="detail" />
      <div className="album-detail__intro">
        <p className="eyebrow">完整专辑</p>
        <h1>{album.title}</h1>
        {album.aliases.length ? <p className="album-detail__aliases">别名：{album.aliases.join("、")}</p> : null}
        <p className="album-detail__artists">{album.artists.map((artist) => artist.name).join("、")}</p>
        <dl className="album-meta">
          <div><dt>发行</dt><dd>{formatPartialDate(album.releaseDate, album.releaseDatePrecision)}</dd></div>
          <div><dt>类型</dt><dd>{RELEASE_TYPE_LABELS[album.albumType]}</dd></div>
          {album.company ? <div><dt>发行公司</dt><dd>{album.company}</dd></div> : null}
          <div><dt>曲目</dt><dd>{album.trackCount} 首{totalDuration ? ` · 约 ${Math.round(totalDuration / 60000)} 分钟` : ""}</dd></div>
        </dl>
        <a className="button button--primary netease-album-link" href={album.externalUrl} target="_blank" rel="noopener noreferrer">在网易云音乐中查看 ↗</a>
        <p className="source-note">专辑与曲目信息来自网易云音乐离线目录快照。</p>
        <AlbumDetailActions album={album} />
      </div>
    </header>
    <div className="album-detail__content">
      {album.coreGenres.length || album.relatedGenres.length || album.descriptors.length ? <section className="detail-card" aria-labelledby="signals-title">
        <p className="section-kicker">分类依据</p>
        <h2 id="signals-title">流派与声音特征</h2>
        <div className="signal-groups">
          {album.coreGenres.length ? <div><h3>核心流派</h3>{album.coreGenres.map((item) => <Link key={item} href={`/discover?genre=${encodeURIComponent(item)}`}>{getTaxonomyLabel(item)}</Link>)}</div> : null}
          {album.relatedGenres.length ? <div><h3>相关流派</h3>{album.relatedGenres.map((item) => <Link key={item} href={`/discover?secondary=${encodeURIComponent(item)}`}>{getTaxonomyLabel(item)}</Link>)}</div> : null}
          {album.descriptors.length ? <div><h3>氛围与特征</h3>{album.descriptors.map((item) => <Link key={item} href={`/discover?descriptor=${encodeURIComponent(item)}`}>{getDescriptorLabel(item)}</Link>)}</div> : null}
        </div>
        {hasRymTaxonomy ? <p className="source-note">相关流派与氛围特征来自人工核验的离线 RYM 分类快照。</p> : null}
      </section> : null}
      {album.editorial ? <section className="detail-card detail-card--guide" aria-labelledby="guide-title"><p className="section-kicker">聆听导览</p><h2 id="guide-title">为什么值得完整听</h2><p>{album.editorial.summaryZh}</p><p>{album.editorial.whyListenZh}</p></section> : null}
      <section className="detail-card detail-card--tracks" aria-labelledby="tracks-title"><p className="section-kicker">网易云专辑曲序</p><h2 id="tracks-title">曲目表</h2><TrackList tracks={album.tracks} /></section>
    </div>
  </article>;
}
