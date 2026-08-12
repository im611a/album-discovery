import { Suspense } from "react";
import Link from "next/link";
import { buildAlbumDetailViewModel, type AlbumDetailViewModel } from "@/catalog/album-detail-view-model";
import { Breadcrumb, ExternalLink } from "@/components/control-primitives";
import { AlbumDiscovery } from "@/components/discovery/album-discovery";
import { AlbumDiscoveryView } from "@/components/discovery/album-discovery-view";
import { DiscoveryContextLink } from "@/components/discovery/discovery-context-link";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { getListeningSceneLabel } from "@/catalog/listening-scenes";
import { formatPartialDate, RELEASE_TYPE_LABELS, type PublishedAlbum, type PublishedAlbumSummary } from "@/catalog/schema";
import { AlbumCover } from "./album-cover";
import { AlbumDetailActions } from "./album-detail-actions";
import { TrackList } from "./track-list";
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";
import { getAlbumRelationFallbackIds, getRelationEligibleAlbumIds } from "@/catalog/personalization";

function SameArtistShelf({ albums }: { albums: PublishedAlbumSummary[] }) {
  return (
    <div className="pa-same-artist-shelf r12-related-works">
      {albums.slice(0, 6).map((item) => (
        <Link
          className="pa-same-artist-shelf__record"
          href={`/albums/${item.slug}`}
          key={item.id}
          aria-label={`查看《${item.title}》专辑详情`}
        >
          <AlbumCover album={item} />
          <span>{item.releaseYear ?? "日期暂缺"} · {RELEASE_TYPE_LABELS[item.albumType]}</span>
          <strong>{item.title}</strong>
        </Link>
      ))}
    </div>
  );
}

function DetailSectionHeading({ number, kicker, title, id }: { number: string; kicker: string; title: string; id: string }) {
  return <header className="r12-detail-section-heading"><span aria-hidden="true">{number}</span><div><p className="section-kicker">{kicker}</p><h2 id={id}>{title}</h2></div></header>;
}

type AlbumDetailProps = {
  album?: PublishedAlbum;
  viewModel?: AlbumDetailViewModel;
  sameArtistAlbums?: PublishedAlbumSummary[];
};

export function AlbumDetail({ album: suppliedAlbum, viewModel, sameArtistAlbums = [] }: AlbumDetailProps) {
  if (!viewModel && !suppliedAlbum) {
    throw new Error("AlbumDetail requires an album or an album detail view model.");
  }
  const resolvedViewModel = viewModel ?? buildAlbumDetailViewModel(suppliedAlbum as PublishedAlbum);
  const album = resolvedViewModel.album;
  const totalDuration = album.tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
  const safeRymReference = resolvedViewModel.rating.reference;
  const neteaseLink = resolvedViewModel.externalLinks[0] ?? null;
  return <article className="album-detail pa-album-file r12-album-object">
    <Breadcrumb items={[{ label: "发现", href: "/discover" }, { label: album.title }]} />
    <header className="album-detail__hero pa-album-file__hero">
      <div className="pa-album-file__object">
        <AlbumCover album={album} size="detail" />
      </div>
      <div className="album-detail__intro">
        <span className="r12-object-index" aria-hidden="true">01</span>
        <p className="eyebrow">ALBUM OBJECT / RELEASE FILE</p>
        <h1>{album.title}</h1>
        {album.aliases.length ? <p className="album-detail__aliases">别名：{album.aliases.join("、")}</p> : null}
        <p className="album-detail__artists">{album.artists.map((artist, index) => <span key={artist.id}>{index ? "、" : ""}<DiscoveryContextLink href={`/artists/artist-${artist.neteaseArtistId}`} currentAlbumSlug={album.slug}>{artist.name}</DiscoveryContextLink></span>)}</p>
        <dl className="album-meta">
          <div><dt>发行</dt><dd>{album.releaseDate ? <DiscoveryContextLink href={`/decades/${Math.floor(Number(album.releaseDate.slice(0, 4)) / 10) * 10}s`} currentAlbumSlug={album.slug}>{formatPartialDate(album.releaseDate, album.releaseDatePrecision)}</DiscoveryContextLink> : formatPartialDate(album.releaseDate, album.releaseDatePrecision)}</dd></div>
          <div><dt>类型</dt><dd>{RELEASE_TYPE_LABELS[album.albumType]}</dd></div>
          {album.company ? <div><dt>发行公司</dt><dd>{album.company}</dd></div> : null}
          <div><dt>曲目</dt><dd>{album.trackCount} 首{totalDuration ? ` · 约 ${Math.round(totalDuration / 60000)} 分钟` : ""}</dd></div>
        </dl>
        <div className="pa-album-file__local-state" aria-label="本地专辑状态">
          <p className="section-kicker">保存到当前设备</p>
          <AlbumDetailActions album={album} />
        </div>
        <div className="pa-album-file__source-entry">
          {neteaseLink ? <ExternalLink className="netease-album-link" href={neteaseLink.href}><span>{neteaseLink.label}</span>查看专辑与曲目信息 ↗</ExternalLink> : <p className="source-note">网易云音乐入口暂不可用。</p>}
        </div>
      </div>
    </header>
    <div className="album-detail__content">
      {album.coreGenres.length || album.relatedGenres.length ? <section className="detail-card" aria-labelledby="signals-title">
        <DetailSectionHeading number="02" kicker="分类依据" title="流派" id="signals-title" />
        <div className="signal-groups">
          {album.coreGenres.length ? <div><h3>核心流派</h3>{album.coreGenres.map((item) => <DiscoveryContextLink key={item} href={`/genres/core/${item}`} currentAlbumSlug={album.slug}>{getTaxonomyLabel(item)}</DiscoveryContextLink>)}</div> : null}
          {album.relatedGenres.length ? <div><h3>相关流派</h3>{album.relatedGenres.map((item) => <DiscoveryContextLink key={item} href={`/genres/related/${item}`} currentAlbumSlug={album.slug}>{getTaxonomyLabel(item)}</DiscoveryContextLink>)}</div> : null}
        </div>
        {album.relatedGenres.length ? <p className="source-note">相关流派来自人工核验的离线 RYM Secondary Genres。</p> : null}
      </section> : null}
      {album.contexts.length ? <section className="detail-card detail-card--scenes" aria-labelledby="scenes-title"><DetailSectionHeading number="02B" kicker="本站策展维度" title="聆听场景" id="scenes-title" /><div className="signal-groups"><div>{album.contexts.map((item) => <DiscoveryContextLink key={item} href={`/scenes/${item}`} currentAlbumSlug={album.slug}>{getListeningSceneLabel(item)}</DiscoveryContextLink>)}</div></div></section> : null}
      {resolvedViewModel.rating.visible ? <section className="detail-card detail-card--rating" aria-labelledby="rym-rating-title">
        <DetailSectionHeading number="02C" kicker="离线核验数据" title="RYM 社区评分" id="rym-rating-title" />
        <p className="rym-rating-value">{resolvedViewModel.rating.value?.toFixed(2)} <span>/ 5</span></p>
        {resolvedViewModel.rating.count != null ? <p>{resolvedViewModel.rating.count.toLocaleString("zh-CN")} 人评分</p> : null}
        <p className="source-note">这是 RYM 社区评分，不是本站评分；本站不接受用户评分。</p>
        {safeRymReference ? <ExternalLink href={safeRymReference}>前往 RYM 查看来源 ↗</ExternalLink> : null}
      </section> : null}
      {album.editorial ? <section className="detail-card detail-card--guide" aria-labelledby="guide-title"><DetailSectionHeading number="03" kicker="聆听导览" title="为什么值得完整听" id="guide-title" /><p>{album.editorial.summaryZh}</p><p>{album.editorial.whyListenZh}</p></section> : null}
      <section className="detail-card detail-card--tracks" aria-labelledby="tracks-title"><DetailSectionHeading number="04" kicker="网易云专辑曲序" title="曲目表" id="tracks-title" /><TrackList tracks={album.tracks} albumArtists={album.artists.map((artist) => artist.name)} /></section>
      {sameArtistAlbums.length ? <section className="related-section" aria-labelledby="same-artist-title"><DetailSectionHeading number="05A" kicker="同一创作者" title="同艺人其他专辑" id="same-artist-title" /><SameArtistShelf albums={sameArtistAlbums} /></section> : null}
      <Suspense fallback={<section className="r14-personal-journey r14-personal-journey--neutral" aria-busy="true"><p>正在读取当前设备上的个人线索…</p></section>}>
        <PersonalJourneySurface
          context="ALBUM"
          source="album"
          eyebrow="PERSONAL PATH / 与目录关系分开"
          title="从这张作品与本机线索继续"
          className="r14-album-journey"
          currentAlbumSlug={album.slug}
          currentAlbumIds={[album.id]}
          eligibleAlbumIds={getRelationEligibleAlbumIds([album.id])}
          relationFallbackAlbumIds={getAlbumRelationFallbackIds(album.id)}
          limit={6}
        />
      </Suspense>
      <Suspense fallback={<AlbumDiscoveryView presentation={resolvedViewModel.discovery} />}>
        <AlbumDiscovery
          sourceAlbumId={album.id}
          canonicalPresentation={resolvedViewModel.discovery}
        />
      </Suspense>
      <section className="detail-card detail-card--source r12-album-source" aria-labelledby="album-source-title"><DetailSectionHeading number="06" kicker="CANONICAL SOURCE" title="数据来源" id="album-source-title" /><p>专辑身份、发行与曲目信息来自网易云音乐离线目录快照；正常浏览不会向音乐数据源发出请求。</p>{neteaseLink ? <ExternalLink href={neteaseLink.href}>在网易云音乐查看原始专辑页 ↗</ExternalLink> : <p className="unavailable-note">网易云音乐入口暂不可用。</p>}</section>
    </div>
  </article>;
}
