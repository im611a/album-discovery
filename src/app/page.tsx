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
  return <div className="site-shell"><SiteHeader /><main id="main-content">
    <EditorialMotion className="editorial-home">
      <section className="editorial-canvas" aria-labelledby="editorial-home-title">
        <div className="editorial-canvas__masthead" data-motion-opening>
          <p>Album Discovery Archive</p>
          <h1 id="editorial-home-title">专辑发现</h1>
          <p>从真实专辑、流派与聆听线索出发，找到下一张值得完整听完的作品。</p>
          <div><Link href="/discover">浏览 {catalogAlbums.length} 张专辑 →</Link><Link href="/for-you">查看本机推荐 →</Link></div>
        </div>
        <div className="editorial-canvas__grid">
          {editorialAlbums.map(({ album, slot }) => <EditorialAlbumObject key={slot.slot} album={album} slot={slot} opening />)}
        </div>
        <p className="editorial-canvas__scroll" aria-hidden="true">向下浏览 / Scroll</p>
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
