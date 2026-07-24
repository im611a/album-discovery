import Link from "next/link";
import { EditorialAlbumObject } from "@/components/editorial/editorial-album-object";
import { EditorialMotion } from "@/components/editorial/editorial-motion";
import {
  ArtistFeature,
  DecadeTimeline,
  FeaturedAlbumSequence,
  GenreIndex,
  ListeningScenes,
  PersonalDiscovery,
  RecentCollection,
} from "@/components/editorial/editorial-home-sections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { catalogAlbums } from "@/catalog/published-catalog";
import {
  FEATURED_ALBUM_SLUGS,
  resolveConfiguredAlbums,
  resolveEditorialAlbums,
} from "@/config/editorial-home";

export default function Home() {
  const editorialAlbums = resolveEditorialAlbums(catalogAlbums);
  const featuredAlbums = resolveConfiguredAlbums(catalogAlbums, FEATURED_ALBUM_SLUGS);
  const years = catalogAlbums.flatMap((album) => album.releaseYear == null ? [] : [album.releaseYear]);
  const yearRange = years.length ? `${Math.min(...years)}—${Math.max(...years)}` : "发行年份持续整理";
  return <div className="site-shell"><SiteHeader /><main id="main-content">
    <EditorialMotion className="editorial-home">
      <section className="home-gallery" aria-labelledby="editorial-home-title" data-motion-gallery>
        <div className="home-gallery__stage">
          <div className="home-gallery__clip">
            <div className="home-gallery__masthead" data-motion-opening-copy>
              <p>Album Discovery Archive</p>
              <h1 id="editorial-home-title">专辑发现</h1>
              <p>从真实专辑、流派与聆听线索出发。</p>
            </div>
            <div className="home-gallery__mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="home-gallery__grid">
              {editorialAlbums.map(({ album, slot }) => <EditorialAlbumObject key={slot.slot} album={album} slot={slot} opening />)}
            </div>
            <div className="home-gallery__ledger" data-motion-opening-copy>
              <p>{catalogAlbums.length} 张真实专辑</p>
              <p>{yearRange}</p>
              <Link href="/discover">进入目录 ↗</Link>
            </div>
            <p className="home-gallery__scroll" aria-hidden="true">Scroll / 向下浏览</p>
          </div>
        </div>
      </section>
      <div className="editorial-home__flow page-container">
        <FeaturedAlbumSequence albums={featuredAlbums} />
        <ArtistFeature />
        <GenreIndex />
        <DecadeTimeline />
        <ListeningScenes />
        <PersonalDiscovery />
        <RecentCollection />
      </div>
    </EditorialMotion>
  </main><SiteFooter /></div>;
}
