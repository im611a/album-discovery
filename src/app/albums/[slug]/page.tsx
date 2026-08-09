import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumDetail } from "@/components/albums/album-detail";
import { SiteShell } from "@/components/site-primitives";
import { getAlbumsForArtist } from "@/catalog/queries";
import { getAlbumDetailStaticParams, getAlbumDetailViewModel } from "@/catalog/album-detail-view-model";

export const dynamicParams = false;
export function generateStaticParams() { return getAlbumDetailStaticParams(); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const view = getAlbumDetailViewModel((await params).slug);
  if (!view) return { title: "专辑未找到" };
  const album = view.album;
  const description = album.editorial?.summaryZh ?? `${album.artists.map((artist) => artist.name).join("、")}的《${album.title}》专辑资料、曲目与网易云音乐入口。`;
  return { title: `${album.title} · 专辑发现`, description, openGraph: { title: album.title, description, type: "music.album" } };
}
export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewModel = getAlbumDetailViewModel((await params).slug);
  if (!viewModel) notFound();
  const album = viewModel.album;
  const sameArtistAlbums = album.artists.flatMap((artist) => getAlbumsForArtist(artist.id)).filter((item, index, all) => item.id !== album.id && all.findIndex((candidate) => candidate.id === item.id) === index);
  return <SiteShell><AlbumDetail viewModel={viewModel} sameArtistAlbums={sameArtistAlbums} /></SiteShell>;
}
