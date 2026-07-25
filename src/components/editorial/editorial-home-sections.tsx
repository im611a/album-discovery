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
import { RELEASE_TYPE_LABELS } from "@/catalog/schema";
import { FEATURED_ARTIST_SLUGS } from "@/config/editorial-home";

function SectionHeading({
  number,
  kicker,
  title,
  description,
  id,
}: {
  number: string;
  kicker: string;
  title: string;
  description?: string;
  id: string;
}) {
  return (
    <header className="pa-section-heading">
      <p>{number}</p>
      <div>
        <span>{kicker}</span>
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </header>
  );
}

export function ArtistFeature() {
  const artists = FEATURED_ARTIST_SLUGS.flatMap((slug) => {
    const artist = publishedArtists.find((item) => item.slug === slug);
    return artist ? [artist] : [];
  });
  return (
    <section className="pa-artist-archive" aria-labelledby="artist-feature-title">
      <SectionHeading
        number="/04"
        kicker="艺人档案抽屉"
        title="从一位创作者，拉出一组作品。"
        description="作品数量、年份和封套都来自本地艺人索引。"
        id="artist-feature-title"
      />
      <div className="pa-artist-archive__drawers">
        {artists.map((artist, index) => {
          const albums = artist.albumIds.flatMap((id) => {
            const album = catalogAlbums.find((item) => item.id === id);
            return album ? [album] : [];
          }).slice(0, 4);
          const typeSummary = Object.entries(artist.albumCountByType)
            .filter(([, count]) => Boolean(count))
            .map(([type, count]) => `${RELEASE_TYPE_LABELS[type as keyof typeof RELEASE_TYPE_LABELS]} ${count}`)
            .join(" · ");
          return (
            <article className="pa-artist-drawer" key={artist.artistId}>
              <div className="pa-artist-drawer__handle" aria-hidden="true"><span /></div>
              <p className="pa-artist-drawer__number">A-{String(index + 1).padStart(2, "0")}</p>
              <div className="pa-artist-drawer__identity">
                <h3><Link href={`/artists/${artist.slug}`}>{artist.name}</Link></h3>
                <p>{artist.albumCount} 张收录专辑{typeSummary ? ` · ${typeSummary}` : ""}</p>
                {artist.earliestYear && artist.latestYear ? <p>{artist.earliestYear}—{artist.latestYear}</p> : null}
                <p>{artist.commonCoreGenres.map(getTaxonomyLabel).join(" · ")}</p>
                <Link href={`/artists/${artist.slug}`}>打开艺人档案 →</Link>
              </div>
              <div className="pa-artist-drawer__records">
                {albums.map((album) => (
                  <Link key={album.id} href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》`}>
                    <AlbumCover album={album} />
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function GenreIndex() {
  const topics = getTopicSummaries("core");
  return (
    <section className="pa-classification" aria-labelledby="genre-index-title">
      <SectionHeading number="/05" kicker="核心流派隔板" title="十五条进入收藏柜的路径。" id="genre-index-title" />
      <ol className="pa-classification__dividers">
        {topics.map((topic, index) => (
          <li key={topic.key}>
            <Link href={`/genres/core/${topic.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{topic.label}</strong>
              <small>{topic.count} 张</small>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DecadeTimeline() {
  const topics = getTopicSummaries("decade");
  return (
    <section className="pa-decade-shelf" aria-labelledby="decade-title">
      <SectionHeading
        number="/06"
        kicker="发行年代层架"
        title="沿着压片年份，重新组织聆听。"
        id="decade-title"
      />
      <div className="pa-decade-shelf__rail">
        {topics.map((topic) => (
          <Link href={`/decades/${topic.slug}`} key={topic.key}>
            <span>{topic.label}</span>
            <small>{topic.count} 张</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ListeningScenes() {
  const counts = new Map(getTopicSummaries("scene").map((topic) => [topic.key, topic.count]));
  return (
    <section className="pa-scenes" aria-labelledby="scene-title">
      <SectionHeading
        number="/07"
        kicker="本站策展场景"
        title="从此刻的聆听需要出发。"
        description="场景是本站独立策展维度，不冒充外部分类。"
        id="scene-title"
      />
      <div className="pa-scenes__glass">
        {LISTENING_SCENES.filter(([key]) => (counts.get(key) ?? 0) > 0).map(([key], index) => (
          <Link href={`/scenes/${key}`} key={key}>
            <small>S-{String(index + 1).padStart(2, "0")}</small>
            <strong>{getListeningSceneLabel(key)}</strong>
            <span>{counts.get(key)} 张</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PersonalDiscovery() {
  return (
    <section className="pa-personal-bench" aria-labelledby="personal-title">
      <SectionHeading
        number="/08"
        kicker="私人选片台 · 只在本机"
        title="把你的选择，变成下一张专辑。"
        id="personal-title"
      />
      <div className="pa-personal-bench__surface">
        <TasteSetup embedded />
        <div className="pa-personal-bench__recommendations"><HomeRecommendations /></div>
        <div className="pa-personal-bench__random">
          <header><span>稳定随机</span><h3>换一个没有预设的起点。</h3></header>
          <RandomDiscovery />
        </div>
      </div>
    </section>
  );
}

export function RecentCollection() {
  const albums = getRecentlyAdded(8);
  return (
    <section className="pa-intake-ledger" aria-labelledby="recent-title">
      <header className="pa-section-heading">
        <p>/09</p>
        <div>
          <span>目录入库账本</span>
          <h2 id="recent-title">最近收录</h2>
          <p>表示加入本站静态快照的真实时间，不冒充实时发行榜。</p>
        </div>
        <Link href="/new-releases">查看完整账本 →</Link>
      </header>
      <div className="pa-intake-ledger__rows">
        {albums.map((album, index) => <CompactAlbumRow key={album.id} album={album} index={index} />)}
      </div>
    </section>
  );
}
