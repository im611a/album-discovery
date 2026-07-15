import { AlbumGrid } from "@/components/album-grid";
import { RandomDiscovery } from "@/components/random-discovery";
import { SectionHeading } from "@/components/section-heading";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { albumsMock } from "@/data/albums.mock";
import { byHighestRating, byNewestRelease, byRecentlyAdded } from "@/lib/albums";

export default function Home() {
  const recentReleases = byNewestRelease(albumsMock).slice(0, 8);
  const highRatedAlbums = byHighestRating(albumsMock).slice(0, 6);
  const recentlyAddedAlbums = byRecentlyAdded(albumsMock).slice(0, 6);
  const randomCandidates = byHighestRating(albumsMock).slice(0, 8);

  return (
    <div className="site-shell">
      <SiteHeader activePath="/" />
      <main id="main-content">
        <section className="home-intro page-container" aria-labelledby="home-title">
          <p className="eyebrow">从一张专辑开始</p>
          <h1 id="home-title">发现值得从头听到尾的声音。</h1>
          <p>
            按发行、评分与收录时间浏览，也可以把选择交给一次简单的随机发现。
          </p>
        </section>

        <div className="home-sections page-container">
          <section className="album-section" aria-labelledby="recent-heading">
            <SectionHeading
              description="按发行日期排列的近期作品"
              headingId="recent-heading"
              href="/new-releases"
              linkLabel="查看全部"
              title="近期发行"
            />
            <AlbumGrid albums={recentReleases} />
          </section>

          <section className="album-section" aria-labelledby="rated-heading">
            <SectionHeading
              description="兼顾社区评分与足够评分人数的专辑"
              headingId="rated-heading"
              title="高分专辑"
            />
            <AlbumGrid albums={highRatedAlbums} />
          </section>

          <section className="album-section" aria-labelledby="added-heading">
            <SectionHeading
              description="最近加入本站目录的条目"
              headingId="added-heading"
              title="最近收录"
            />
            <AlbumGrid albums={recentlyAddedAlbums} />
          </section>

          <section className="album-section" aria-labelledby="random-heading">
            <SectionHeading
              description="从基础信息完整的专辑中依次抽取"
              headingId="random-heading"
              title="随机发现"
            />
            <RandomDiscovery albums={randomCandidates} />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
