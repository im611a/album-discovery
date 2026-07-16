import { AlbumGrid } from "@/components/album-grid";
import { RandomDiscovery } from "@/components/random-discovery";
import { SectionHeading } from "@/components/section-heading";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { albumsMock } from "@/data/albums.mock";
import { getDiscoverTaxonomyHref } from "@/lib/album-filters";
import { byHighestRating, byNewestRelease } from "@/lib/albums";
import { getDisplayLabel } from "@/lib/display-labels";
import {
  V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT,
  V0_2_HOME_PRIMARY_GENRES,
} from "@/lib/site";
import Link from "next/link";

export default function Home() {
  const recentReleases = byNewestRelease(albumsMock).slice(0, 6);
  const highRatedAlbums = byHighestRating(
    albumsMock,
    V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT,
  ).slice(0, 6);
  const randomCandidates = byHighestRating(albumsMock).slice(0, 8);

  return (
    <div className="site-shell">
      <SiteHeader activePath="/" />
      <main id="main-content">
        <section className="home-intro page-container" aria-labelledby="home-title">
          <p className="eyebrow">从一张专辑开始</p>
          <h1 id="home-title">发现值得从头听到尾的声音。</h1>
          <p>
            按发行、评分与流派浏览，也可以把选择交给一次简单的随机发现。
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
            <AlbumGrid albums={recentReleases} layout="home" />
          </section>

          <section className="album-section" aria-labelledby="rated-heading">
            <SectionHeading
              description="从具有足够评分人数的本地原型样本中选择"
              headingId="rated-heading"
              title="高分专辑"
            />
            <AlbumGrid albums={highRatedAlbums} layout="home" />
          </section>

          <section
            className="album-section genre-exploration"
            aria-labelledby="genres-heading"
          >
            <SectionHeading
              description="从当前本地目录中的主流派继续浏览"
              headingId="genres-heading"
              title="按流派探索"
            />
            <ul className="genre-exploration__list">
              {V0_2_HOME_PRIMARY_GENRES.map((sourceLabel) => (
                <li key={sourceLabel}>
                  <Link href={getDiscoverTaxonomyHref("primaryGenre", sourceLabel)}>
                    <span>{getDisplayLabel(sourceLabel)}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
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
