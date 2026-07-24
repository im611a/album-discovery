import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
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
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="artist-hero"><p className="eyebrow">艺人目录</p><h1>{artist.name}</h1><p>{artist.albumCount} 张收录专辑{typeSummary ? ` · ${typeSummary}` : ""}</p>{artist.earliestYear && artist.latestYear ? <p>发行年份跨度：{artist.earliestYear}–{artist.latestYear}</p> : null}{artist.commonCoreGenres.length ? <div className="artist-hero__genres" aria-label="常见核心流派">{artist.commonCoreGenres.map((genre) => <Link key={genre} href={`/genres/core/${genre}`}>{getTaxonomyLabel(genre)}</Link>)}</div> : null}</header><section className="catalog-section" aria-labelledby="artist-albums-title"><header className="section-heading"><div><p className="section-kicker">按发行日期排列</p><h2 id="artist-albums-title">收录专辑</h2></div></header><AlbumGrid albums={albums} headingLevel={3} /></section></main><SiteFooter /></div>;
}
