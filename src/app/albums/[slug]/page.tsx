import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumDetail } from "@/components/albums/album-detail";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAllAlbums, getAlbumsForArtist } from "@/catalog/queries";
import { getAlbumDetailBySlug } from "@/catalog/published-album-details";

export const dynamicParams = false;
export function generateStaticParams() {
  return getAllAlbums().map((album) => ({ slug: album.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const album = getAlbumDetailBySlug((await params).slug);
  if (!album) return { title: "专辑未找到" };
  const description = album.editorial?.summaryZh ?? `${album.artists.map((artist) => artist.name).join("、")}的《${album.title}》专辑资料、曲目与网易云音乐入口。`;
  return { title: `${album.title} · 专辑发现`, description, openGraph: { title: album.title, description, type: "music.album" } };
}
export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const album = getAlbumDetailBySlug((await params).slug);
  if (!album) notFound();
  const sameArtistAlbums = album.artists.flatMap((artist) => getAlbumsForArtist(artist.id)).filter((item, index, all) => item.id !== album.id && all.findIndex((candidate) => candidate.id === item.id) === index);
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><AlbumDetail album={album} sameArtistAlbums={sameArtistAlbums} /></main><SiteFooter /></div>;
}
