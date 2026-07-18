import Link from "next/link";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { getRelatedAlbums } from "@/catalog/queries";
import { formatPartialDate, RELEASE_TYPE_LABELS, type PublishedAlbum } from "@/catalog/schema";
import { AlbumGrid } from "@/components/album-grid";
import { AlbumCover } from "./album-cover";
import { AlbumDetailActions } from "./album-detail-actions";
import { TrackList } from "./track-list";

export function AlbumDetail({ album }: { album: PublishedAlbum }) {
  const startTrack = album.tracks.find((track) => track.id === album.editorial?.startWithTrackId);
  const totalDuration = album.tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
  const related = getRelatedAlbums(album);
  return <article className="album-detail">
    <nav className="breadcrumbs" aria-label="面包屑"><Link href="/discover">发现</Link><span aria-hidden="true">/</span><span>{album.title}</span></nav>
    <header className="album-detail__hero"><AlbumCover album={album} size="detail" /><div className="album-detail__intro"><p className="eyebrow">完整专辑导览</p><h1>{album.title}</h1>{album.alternateTitles.length ? <p className="album-detail__aliases">别名：{album.alternateTitles.join("、")}</p> : null}<p className="album-detail__artists">{album.artists.map((artist) => artist.name).join("、")}</p><dl className="album-meta"><div><dt>发行</dt><dd>{formatPartialDate(album.releaseDate)}</dd></div><div><dt>类型</dt><dd>{RELEASE_TYPE_LABELS[album.releaseType]}</dd></div>{album.tracks.length ? <div><dt>长度</dt><dd>{album.tracks.length} 首{totalDuration ? ` · 约 ${Math.round(totalDuration / 60000)} 分钟` : ""}</dd></div> : null}</dl><AlbumDetailActions album={album} /></div></header>
    <div className="album-detail__content">
      <section className="detail-card detail-card--guide" aria-labelledby="guide-title"><p className="section-kicker">为什么听</p><h2 id="guide-title">{album.editorial ? "这张专辑可能适合你" : "从类型与场景开始"}</h2><p>{album.editorial?.summaryZh ?? `这张专辑被本站归入${album.primaryGenres.map(getTaxonomyLabel).join("、")}，可从完整曲序开始探索。`}</p>{album.editorial ? <p>{album.editorial.whyListenZh}</p> : null}{startTrack ? <div className="start-with"><span>可以从这里开始</span><strong>{startTrack.title}</strong></div> : <p className="unavailable-note">暂无经核验的起始曲建议。</p>}</section>
      <section className="detail-card" aria-labelledby="signals-title"><p className="section-kicker">发现信号</p><h2 id="signals-title">类型、描述与场景</h2><div className="signal-groups"><div><h3>主流派</h3>{album.primaryGenres.map((item) => <Link key={item} href={`/discover?genre=${encodeURIComponent(item)}`}>{getTaxonomyLabel(item)}</Link>)}</div><div><h3>描述</h3>{album.descriptors.map((item) => <Link key={item} href={`/discover?descriptor=${encodeURIComponent(item)}`}>{item}</Link>)}</div><div><h3>场景</h3>{album.contexts.map((item) => <Link key={item} href={`/discover?context=${encodeURIComponent(item)}`}>{item}</Link>)}</div></div></section>
      <section className="detail-card detail-card--tracks" aria-labelledby="tracks-title"><p className="section-kicker">代表版本</p><h2 id="tracks-title">曲目表</h2>{album.representativeReleaseId ? <p className="support-copy">曲序来自一个确定的 MusicBrainz release，不代表所有再版版本。</p> : null}<TrackList tracks={album.tracks} /></section>
      <section className="detail-card" aria-labelledby="listen-title"><p className="section-kicker">离开本站聆听</p><h2 id="listen-title">经核验的外部去向</h2>{album.externalLinks.length ? <div className="external-links">{album.externalLinks.map((link) => <a key={`${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer"><strong>{link.platform}</strong><span>{link.kind === "purchase" ? "购买" : "打开专辑"} ↗</span></a>)}</div> : <><p className="unavailable-note">暂无可验证的直达链接。</p><code className="copy-query">{album.artists.map((artist) => artist.name).join(" ")} {album.title}</code></>}</section>
      <section className="detail-card source-note" aria-labelledby="source-title"><p className="section-kicker">数据透明</p><h2 id="source-title">来源与边界</h2><p>专辑身份与发行元数据来自 MusicBrainz，刷新于 {album.sourceSummary.refreshedAt}。{album.editorial ? "中文导览为本站原创 metadata-based 内容，尚未标记为人工策展评论。" : "当前没有补写未经核验的编辑事实。"}</p><a href={album.sourceSummary.metadataUrl} target="_blank" rel="noopener noreferrer">查看 MusicBrainz 条目 ↗</a></section>
      {related.length ? <section className="related-section" aria-labelledby="related-title"><header className="section-heading"><div><p className="section-kicker">相同类型或聆听信号</p><h2 id="related-title">继续发现</h2></div></header><AlbumGrid albums={related} /></section> : null}
    </div>
  </article>;
}
