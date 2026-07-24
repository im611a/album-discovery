import Link from "next/link";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { getListeningSceneLabel } from "@/catalog/listening-scenes";
import { formatPartialDate, RELEASE_TYPE_LABELS, type PublishedAlbum, type PublishedAlbumSummary } from "@/catalog/schema";
import { AlbumGrid } from "@/components/album-grid";
import { AlbumCover } from "./album-cover";
import { AlbumDetailActions } from "./album-detail-actions";
import { TrackList } from "./track-list";
import { ContinueExploring } from "@/components/explore/continue-exploring";

export function AlbumDetail({ album, sameArtistAlbums = [] }: { album: PublishedAlbum; sameArtistAlbums?: PublishedAlbumSummary[] }) {
  const totalDuration = album.tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
  const safeRymReference = album.rymReference?.startsWith("https://rateyourmusic.com/") ? album.rymReference : null;
  return <article className="album-detail">
    <nav className="breadcrumbs" aria-label="面包屑"><Link href="/discover">发现</Link><span aria-hidden="true">/</span><span>{album.title}</span></nav>
    <header className="album-detail__hero">
      <AlbumCover album={album} size="detail" />
      <div className="album-detail__intro">
        <p className="eyebrow">完整专辑</p>
        <h1>{album.title}</h1>
        {album.aliases.length ? <p className="album-detail__aliases">别名：{album.aliases.join("、")}</p> : null}
        <p className="album-detail__artists">{album.artists.map((artist, index) => <span key={artist.id}>{index ? "、" : ""}<Link href={`/artists/artist-${artist.neteaseArtistId}`}>{artist.name}</Link></span>)}</p>
        <dl className="album-meta">
          <div><dt>发行</dt><dd>{album.releaseDate ? <Link href={`/decades/${Math.floor(Number(album.releaseDate.slice(0, 4)) / 10) * 10}s`}>{formatPartialDate(album.releaseDate, album.releaseDatePrecision)}</Link> : formatPartialDate(album.releaseDate, album.releaseDatePrecision)}</dd></div>
          <div><dt>类型</dt><dd>{RELEASE_TYPE_LABELS[album.albumType]}</dd></div>
          {album.company ? <div><dt>发行公司</dt><dd>{album.company}</dd></div> : null}
          <div><dt>曲目</dt><dd>{album.trackCount} 首{totalDuration ? ` · 约 ${Math.round(totalDuration / 60000)} 分钟` : ""}</dd></div>
        </dl>
        <a className="netease-album-link" href={album.externalUrl} target="_blank" rel="noopener noreferrer"><span>网易云音乐</span>查看专辑与曲目信息 ↗</a>
        <p className="source-note">专辑与曲目信息来自网易云音乐离线目录快照。</p>
        <AlbumDetailActions album={album} />
      </div>
    </header>
    <div className="album-detail__content">
      <section className="detail-card detail-card--tracks" aria-labelledby="tracks-title"><p className="section-kicker">网易云专辑曲序</p><h2 id="tracks-title">曲目表</h2><TrackList tracks={album.tracks} /></section>
      {album.rymRating != null ? <section className="detail-card detail-card--rating" aria-labelledby="rym-rating-title">
        <p className="section-kicker">离线核验数据</p>
        <h2 id="rym-rating-title">RYM 社区评分</h2>
        <p className="rym-rating-value">{album.rymRating.toFixed(2)} <span>/ 5</span></p>
        {album.rymRatingCount != null ? <p>{album.rymRatingCount.toLocaleString("zh-CN")} 人评分</p> : null}
        <p className="source-note">这是 RYM 社区评分，不是本站评分；本站不接受用户评分。</p>
        {safeRymReference ? <a href={safeRymReference} target="_blank" rel="noopener noreferrer">前往 RYM 查看来源 ↗</a> : null}
      </section> : null}
      {album.coreGenres.length || album.relatedGenres.length ? <section className="detail-card" aria-labelledby="signals-title">
        <p className="section-kicker">分类依据</p>
        <h2 id="signals-title">流派</h2>
        <div className="signal-groups">
          {album.coreGenres.length ? <div><h3>核心流派</h3>{album.coreGenres.map((item) => <Link key={item} href={`/genres/core/${item}`}>{getTaxonomyLabel(item)}</Link>)}</div> : null}
          {album.relatedGenres.length ? <div><h3>相关流派</h3>{album.relatedGenres.map((item) => <Link key={item} href={`/genres/related/${item}`}>{getTaxonomyLabel(item)}</Link>)}</div> : null}
        </div>
        {album.relatedGenres.length ? <p className="source-note">相关流派来自人工核验的离线 RYM Secondary Genres。</p> : null}
      </section> : null}
      {album.contexts.length ? <section className="detail-card detail-card--scenes" aria-labelledby="scenes-title"><p className="section-kicker">本站策展维度</p><h2 id="scenes-title">聆听场景</h2><div className="signal-groups"><div>{album.contexts.map((item) => <Link key={item} href={`/scenes/${item}`}>{getListeningSceneLabel(item)}</Link>)}</div></div></section> : null}
      {album.editorial ? <section className="detail-card detail-card--guide" aria-labelledby="guide-title"><p className="section-kicker">聆听导览</p><h2 id="guide-title">为什么值得完整听</h2><p>{album.editorial.summaryZh}</p><p>{album.editorial.whyListenZh}</p></section> : null}
      {sameArtistAlbums.length ? <section className="related-section" aria-labelledby="same-artist-title"><p className="section-kicker">继续浏览</p><h2 id="same-artist-title">同艺人其他专辑</h2><AlbumGrid albums={sameArtistAlbums.slice(0, 6)} headingLevel={3} /></section> : null}
      <ContinueExploring albumId={album.id} />
    </div>
  </article>;
}
