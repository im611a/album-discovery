import { Suspense } from "react";
import { ArtistDirectory } from "@/components/artists/artist-directory";
import { publishedArtists } from "@/catalog/published-catalog";
import { PageHeader, SiteShell } from "@/components/site-primitives";

export default function ArtistsPage() {
  return <SiteShell mainClassName="pa-artist-index r12-artist-directory"><PageHeader eyebrow={`${publishedArtists.length} 位创作者的作品索引`} title="艺人档案" className="pa-artist-index__intro r12-page-intro--compact">按已收录专辑的核心流派进入艺人档案，再用名称搜索或作品数量排序；本站没有可靠地区字段，因此不提供推断式地域分类。</PageHeader><Suspense fallback={<p className="status-message">正在准备艺人索引…</p>}><ArtistDirectory /></Suspense></SiteShell>;
}
