import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import { CompactAlbumRow } from "./compact-album-row";
import { HomeRecommendations } from "@/components/home/home-recommendations";
import { RandomDiscovery } from "@/components/home/random-discovery";
import { TasteSetup } from "@/components/taste/taste-setup";
import { getListeningSceneLabel, LISTENING_SCENES } from "@/catalog/listening-scenes";
import { catalogAlbums, getTaxonomyLabel, publishedArtists } from "@/catalog/published-catalog";
import { getRecentlyAdded } from "@/catalog/queries";
import { getTopicSummaries } from "@/catalog/topics";
import { RELEASE_TYPE_LABELS, type PublishedAlbumSummary } from "@/catalog/schema";
import { FEATURED_ARTIST_SLUGS } from "@/config/editorial-home";

export function FeaturedAlbumSequence({ albums }: { albums: PublishedAlbumSummary[] }) {
  return <section className="editorial-sequence" aria-labelledby="featured-sequence-title" data-motion-reveal>
    <header className="editorial-section-heading">
      <p>/01–03</p>
      <div><p className="section-kicker">重点专辑</p><h2 id="featured-sequence-title">三张专辑，三种完整聆听的入口。</h2></div>
    </header>
    <div className="editorial-sequence__list">
      {albums.map((album, index) => <article className="featured-album" key={album.id}>
        <p className="featured-album__number">/{String(index + 1).padStart(2, "0")}</p>
        <Link className="featured-album__cover" href={`/albums/${album.slug}`}><AlbumCover album={album} /></Link>
        <div className="featured-album__copy">
          <h3><Link href={`/albums/${album.slug}`}>{album.title}</Link></h3>
          <p>{album.artists.map((artist) => artist.name).join("、")}</p>
          <p>{album.releaseYear ?? "发行日期暂缺"} · {RELEASE_TYPE_LABELS[album.albumType]}</p>
          <div>{album.coreGenres.map((genre) => <Link key={genre} href={`/genres/core/${genre}`}>{getTaxonomyLabel(genre)}</Link>)}</div>
          {album.rymRating != null ? <p>RYM {album.rymRating.toFixed(2)}</p> : null}
        </div>
      </article>)}
    </div>
  </section>;
}

export function ArtistFeature() {
  const artists = FEATURED_ARTIST_SLUGS.flatMap((slug) => {
    const artist = publishedArtists.find((item) => item.slug === slug);
    return artist ? [artist] : [];
  });
  return <section className="artist-feature-section" aria-labelledby="artist-feature-title" data-motion-reveal>
    <header className="editorial-section-heading">
      <p>/04</p>
      <div><p className="section-kicker">艺人档案</p><h2 id="artist-feature-title">从一位创作者，走进一组专辑。</h2></div>
    </header>
    <div className="artist-feature-list">{artists.map((artist, index) => {
      const albums = artist.albumIds.flatMap((id) => {
        const album = catalogAlbums.find((item) => item.id === id);
        return album ? [album] : [];
      }).slice(0, 4);
      const typeSummary = Object.entries(artist.albumCountByType)
        .filter(([, count]) => Boolean(count))
        .map(([type, count]) => `${RELEASE_TYPE_LABELS[type as keyof typeof RELEASE_TYPE_LABELS]} ${count}`)
        .join(" · ");
      return <article className="artist-feature" key={artist.artistId}>
        <p className="artist-feature__number">/0{index + 1}</p>
        <div className="artist-feature__identity">
          <h3><Link href={`/artists/${artist.slug}`}>{artist.name}</Link></h3>
          <p>{artist.albumCount} 张收录专辑{typeSummary ? ` · ${typeSummary}` : ""}</p>
          {artist.earliestYear && artist.latestYear ? <p>{artist.earliestYear}–{artist.latestYear}</p> : null}
          <p>{artist.commonCoreGenres.map(getTaxonomyLabel).join(" · ")}</p>
          <Link href={`/artists/${artist.slug}`}>查看艺人档案 →</Link>
        </div>
        <div className="artist-feature__covers">
          {albums.map((album) => <Link key={album.id} href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》`}><AlbumCover album={album} /></Link>)}
        </div>
      </article>;
    })}</div>
  </section>;
}

export function GenreIndex() {
  const topics = getTopicSummaries("core");
  return <section className="editorial-index-section" aria-labelledby="genre-index-title" data-motion-reveal>
    <header className="editorial-section-heading"><p>/05</p><div><p className="section-kicker">核心流派</p><h2 id="genre-index-title">十五条进入目录的路径。</h2></div></header>
    <ol className="editorial-link-index">{topics.map((topic, index) => <li key={topic.key}><Link href={`/genres/core/${topic.slug}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{topic.label}</strong><small>{topic.count} 张</small></Link></li>)}</ol>
  </section>;
}

export function DecadeTimeline() {
  const topics = getTopicSummaries("decade");
  return <section className="decade-timeline-section" aria-labelledby="decade-title" data-motion-reveal>
    <header className="editorial-section-heading"><p>/06</p><div><p className="section-kicker">发行年代</p><h2 id="decade-title">沿着时间，重新组织聆听。</h2></div></header>
    <div className="decade-timeline">{topics.map((topic) => <Link href={`/decades/${topic.slug}`} key={topic.key}><span>{topic.label}</span><small>{topic.count} 张</small></Link>)}</div>
  </section>;
}

export function ListeningScenes() {
  const counts = new Map(getTopicSummaries("scene").map((topic) => [topic.key, topic.count]));
  return <section className="listening-scenes-section" aria-labelledby="scene-title" data-motion-reveal>
    <header className="editorial-section-heading"><p>/07</p><div><p className="section-kicker">本站策展</p><h2 id="scene-title">从此刻的聆听需要出发。</h2></div></header>
    <div className="scene-editorial-grid">{LISTENING_SCENES.map(([key]) => <Link href={`/scenes/${key}`} key={key}><span>{getListeningSceneLabel(key)}</span><small>{counts.get(key) ?? 0} 张</small></Link>)}</div>
  </section>;
}

export function PersonalDiscovery() {
  return <section className="personal-discovery-section" aria-labelledby="personal-title" data-motion-reveal>
    <header className="editorial-section-heading"><p>/08</p><div><p className="section-kicker">只在本机</p><h2 id="personal-title">把你的选择，变成下一张专辑。</h2></div></header>
    <TasteSetup embedded />
    <div className="personal-discovery-section__recommendations"><HomeRecommendations /></div>
    <div className="personal-discovery-section__random"><header><p className="section-kicker">稳定随机</p><h3>换一个没有预设的起点。</h3></header><RandomDiscovery /></div>
  </section>;
}

export function RecentCollection() {
  const albums = getRecentlyAdded(8);
  return <section className="recent-collection-section" aria-labelledby="recent-title" data-motion-reveal>
    <header className="editorial-section-heading"><p>/09</p><div><p className="section-kicker">目录更新</p><h2 id="recent-title">最近收录</h2><p>表示加入本站静态快照的时间，不冒充实时发行榜。</p></div><Link href="/new-releases">查看全部 →</Link></header>
    <div className="compact-album-list">{albums.map((album, index) => <CompactAlbumRow key={album.id} album={album} index={index} />)}</div>
  </section>;
}

