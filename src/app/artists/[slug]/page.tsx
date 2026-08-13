import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlbumCover } from "@/components/albums/album-cover";
import { ArtistDiscovery } from "@/components/discovery/artist-discovery";
import { EntityDiscoveryView } from "@/components/discovery/entity-discovery-view";
import { SiteShell } from "@/components/site-primitives";
import { buildArtistDiscoveryPresentation } from "@/catalog/discovery/artist-topic-presentation";
import { getAlbumsForArtist } from "@/catalog/queries";
import { getArtistBySlug, getTaxonomyLabel, publishedArtists } from "@/catalog/published-catalog";
import { RELEASE_TYPE_LABELS } from "@/catalog/schema";
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";
import { getRelationEligibleAlbumIds } from "@/catalog/personalization";
import { ReturnContextLink, ReturnJourneyAffordance } from "@/components/navigation/return-journey";

export const dynamicParams = false;
export function generateStaticParams() {
  return publishedArtists.map((artist) => ({ slug: artist.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const artist = getArtistBySlug((await params).slug);
  return artist ? { title: `${artist.name} · 艺人` } : { title: "艺人未找到" };
}
export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const artist = getArtistBySlug((await params).slug);
  if (!artist) notFound();
  const albums = getAlbumsForArtist(artist.artistId);
  const discoveryPresentation = buildArtistDiscoveryPresentation(artist.artistId);
  if (!discoveryPresentation) throw new Error(`Missing discovery presentation for artist ${artist.artistId}.`);
  const typeSummary = Object.entries(artist.albumCountByType).map(([type, count]) => `${RELEASE_TYPE_LABELS[type as keyof typeof RELEASE_TYPE_LABELS]} ${count}`).join(" · ");
  const representativeAlbums = albums.slice(0, 3);
  const chronology = albums.reduce<Array<{ year: string; albums: typeof albums }>>((groups, album) => {
    const year = album.releaseYear ? String(album.releaseYear) : "日期暂缺";
    const group = groups.at(-1);
    if (group?.year === year) group.albums.push(album); else groups.push({ year, albums: [album] });
    return groups;
  }, []);
  return <SiteShell mainClassName="r12-artist-file-page">
    <ReturnJourneyAffordance />
    <header className="artist-hero pa-artist-file">
      <div className="artist-hero__copy"><p className="eyebrow">CREATOR ARCHIVE</p><h1>{artist.name}</h1><div className="pa-artist-file__facts"><p><strong>{artist.albumCount}</strong> 张收录专辑</p>{typeSummary ? <p>{typeSummary}</p> : null}{artist.earliestYear && artist.latestYear ? <p>发行年份跨度：{artist.earliestYear}–{artist.latestYear}</p> : null}</div>{artist.commonCoreGenres.length ? <div className="artist-hero__genres" aria-label="常见核心流派">{artist.commonCoreGenres.map((genre) => <ReturnContextLink key={genre} href={`/genres/core/${genre}`}>{getTaxonomyLabel(genre)}</ReturnContextLink>)}</div> : null}</div>
      {representativeAlbums.length ? <nav className="pa-artist-file__works" aria-label={`${artist.name}的作品封面证据`}>{representativeAlbums.map((album) => <ReturnContextLink key={album.id} href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑详情`}><AlbumCover album={album} /><span>{album.releaseYear ?? "日期暂缺"} · {album.title}</span></ReturnContextLink>)}</nav> : null}
    </header>
    <section className="catalog-section pa-artist-catalog r12-discography" aria-labelledby="artist-albums-title"><header className="section-heading"><div><p className="section-kicker">DISCOGRAPHY / CHRONOLOGY</p><h2 id="artist-albums-title">作品年表</h2></div><p>{albums.length} 件作品 · 新到旧</p></header>
      <div className="r12-discography__timeline">{chronology.map((group) => <section key={group.year} className="r12-discography__year" aria-labelledby={`artist-year-${group.year}`}><h3 id={`artist-year-${group.year}`}>{group.year}</h3><div>{group.albums.map((album) => <article key={album.id} className="r12-discography__release"><ReturnContextLink href={`/albums/${album.slug}`} className="r12-discography__cover"><AlbumCover album={album} /></ReturnContextLink><div><h4><ReturnContextLink href={`/albums/${album.slug}`}>{album.title}</ReturnContextLink></h4><p>{RELEASE_TYPE_LABELS[album.albumType]}{album.releaseDate ? ` · ${album.releaseDate}` : " · 发行日期暂缺"}</p>{album.coreGenres.length ? <p>{album.coreGenres.slice(0, 3).map(getTaxonomyLabel).join(" · ")}</p> : null}</div></article>)}</div></section>)}</div>
    </section>
    <Suspense fallback={<section className="r14-personal-journey r14-personal-journey--neutral" aria-busy="true"><p>正在读取当前设备上的个人线索…</p></section>}>
      <PersonalJourneySurface
        context="ARTIST"
        source="artist"
        eyebrow="PERSONAL PATH / 年表之后"
        title="从这位艺人与本机线索继续"
        className="r14-artist-journey"
        currentAlbumIds={albums.map((album) => album.id)}
        eligibleAlbumIds={getRelationEligibleAlbumIds(albums.map((album) => album.id))}
        relationFallbackAlbumIds={[discoveryPresentation.primary.target.id, ...discoveryPresentation.alternates.map((option) => option.target.id)]}
        limit={6}
      />
    </Suspense>
    <Suspense fallback={<EntityDiscoveryView presentation={discoveryPresentation} />}>
      <ArtistDiscovery artistId={artist.artistId} canonicalPresentation={discoveryPresentation} />
    </Suspense>
  </SiteShell>;
}
