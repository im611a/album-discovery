import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { AlbumCover } from "@/components/albums/album-cover";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAlbumsForArtist } from "@/catalog/queries";
import { getArtistBySlug, getTaxonomyLabel, publishedArtists } from "@/catalog/published-catalog";
import { RELEASE_TYPE_LABELS } from "@/catalog/schema";

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
  const typeSummary = Object.entries(artist.albumCountByType).map(([type, count]) => `${RELEASE_TYPE_LABELS[type as keyof typeof RELEASE_TYPE_LABELS]} ${count}`).join(" · ");
  const representativeAlbums = albums.slice(0, 5);
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="artist-hero pa-artist-file"><div className="artist-hero__copy"><p className="eyebrow">艺人唱片档案</p><h1>{artist.name}</h1><div className="pa-artist-file__facts"><p><strong>{artist.albumCount}</strong> 张收录专辑</p>{typeSummary ? <p>{typeSummary}</p> : null}{artist.earliestYear && artist.latestYear ? <p>发行年份跨度：{artist.earliestYear}–{artist.latestYear}</p> : null}</div>{artist.commonCoreGenres.length ? <div className="artist-hero__genres" aria-label="常见核心流派">{artist.commonCoreGenres.map((genre) => <Link key={genre} href={`/genres/core/${genre}`}>{getTaxonomyLabel(genre)}</Link>)}</div> : null}</div>{representativeAlbums.length ? <div className="artist-hero__cluster pa-artist-file__shelf" aria-label={`${artist.name}的代表专辑`} data-cluster-count={representativeAlbums.length}><span className="pa-artist-file__rail" aria-hidden="true" />{representativeAlbums.map((album, index) => <Link key={album.id} href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑详情`} style={{ "--cluster-index": index } as CSSProperties}><AlbumCover album={album} /><span>{String(index + 1).padStart(2, "0")}</span></Link>)}</div> : null}</header><section className="catalog-section pa-artist-catalog" aria-labelledby="artist-albums-title"><header className="section-heading"><div><p className="section-kicker">按发行日期排列</p><h2 id="artist-albums-title">收录专辑</h2></div><p>{albums.length} 件作品沿档案架展开</p></header><AlbumGrid albums={albums} headingLevel={3} /></section></main><SiteFooter /></div>;
}
