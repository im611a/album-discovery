import { Suspense } from "react";
import { ArtistDirectory } from "@/components/artists/artist-directory";
import { publishedArtists } from "@/catalog/published-catalog";
import { PageHeader, SiteShell } from "@/components/site-primitives";

export default function ArtistsPage() {
  return <SiteShell mainClassName="pa-artist-index r12-artist-directory"><PageHeader eyebrow={`${publishedArtists.length} 位创作者的作品索引`} title="艺人档案" className="pa-artist-index__intro r12-page-intro--compact">先按显示名称的文字系统缩小范围，再用搜索与排序定位艺人；不把文字形式推断成国家、地区、国籍或语言。</PageHeader><Suspense fallback={<p className="status-message">正在准备艺人索引…</p>}><ArtistDirectory /></Suspense></SiteShell>;
}
