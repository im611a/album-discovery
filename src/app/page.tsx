import Link from "next/link";
import { RingCabinet, ThreeAlbumStage } from "@/components/editorial/physical-archive-home";
import {
  ArtistFeature,
  DecadeTimeline,
  GenreIndex,
  ListeningScenes,
  PersonalDiscovery,
  RecentCollection,
} from "@/components/editorial/editorial-home-sections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { catalogAlbums } from "@/catalog/published-catalog";
import { getAlbumDetailBySlug } from "@/catalog/published-album-details";
import {
  FEATURED_ALBUM_SLUGS,
  resolvePhysicalArchiveAlbums,
} from "@/config/editorial-home";

export default function Home() {
  const cabinetAlbums = resolvePhysicalArchiveAlbums(catalogAlbums);
  const featuredAlbums = FEATURED_ALBUM_SLUGS.flatMap((slug) => {
    const album = getAlbumDetailBySlug(slug);
    return album ? [album] : [];
  });
  const years = catalogAlbums.flatMap((album) => album.releaseYear == null ? [] : [album.releaseYear]);
  const yearRange = years.length ? `${Math.min(...years)}—${Math.max(...years)}` : "发行年份持续整理";

  return (
    <div className="site-shell pa-site">
      <SiteHeader />
      <main id="main-content">
        <section className="pa-opening" aria-labelledby="pa-home-title" data-static-archive-opening>
          <header className="pa-opening__title">
            <p>Album Discovery</p>
            <h1 id="pa-home-title">专辑发现</h1>
            <span>从真实唱片、流派与聆听线索出发。</span>
          </header>
          <RingCabinet albums={cabinetAlbums} />
          <aside className="pa-opening__facts">
            <p><strong>{catalogAlbums.length}</strong><span>张真实专辑</span></p>
            <p><strong>{yearRange}</strong><span>发行年代跨度</span></p>
            <Link href="/discover">进入收藏目录 <span aria-hidden="true">↗</span></Link>
          </aside>
        </section>

        <div className="pa-home-flow page-container">
          <ThreeAlbumStage albums={featuredAlbums} />
          <ArtistFeature />
          <GenreIndex />
          <DecadeTimeline />
          <ListeningScenes />
          <PersonalDiscovery />
          <RecentCollection />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
