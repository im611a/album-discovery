import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AlbumDetail } from "@/components/albums/album-detail";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { albumsMock } from "@/data/albums.mock";
import { getAlbumDetailBySlug } from "@/lib/album-details";
import { formatArtists } from "@/lib/albums";

type AlbumDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return albumsMock.map((album) => ({ slug: album.slug }));
}

export async function generateMetadata({
  params,
}: AlbumDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = getAlbumDetailBySlug(slug);

  if (!result) {
    return {
      title: "没有找到这张专辑 · 专辑发现",
    };
  }

  return {
    title: `${result.album.title} · ${formatArtists(result.album.artists)} · 专辑发现`,
    description: `${result.album.title} 的本地虚构专辑详情原型，由 ${formatArtists(result.album.artists)} 创作。`,
  };
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { slug } = await params;
  const result = getAlbumDetailBySlug(slug);

  if (!result) notFound();

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="album-detail-main page-container" id="main-content">
        <nav aria-label="面包屑" className="album-breadcrumb">
          <Link href="/discover">发现专辑</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{result.album.title}</span>
        </nav>
        <AlbumDetail album={result.album} detail={result.detail} />
      </main>
      <SiteFooter />
    </div>
  );
}
