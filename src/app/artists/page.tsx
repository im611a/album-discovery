import { Suspense } from "react";
import { ArtistDirectory } from "@/components/artists/artist-directory";
import { PageHeader, SiteShell } from "@/components/site-primitives";

export default function ArtistsPage() {
  return <SiteShell mainClassName="pa-artist-index r12-artist-directory"><PageHeader eyebrow="298 位创作者的作品索引" title="艺人档案" className="pa-artist-index__intro r12-page-intro--compact">按名称或本站收录专辑数量快速定位艺人；不展示虚构简介、照片、热度或排名。</PageHeader><Suspense fallback={<p className="status-message">正在准备艺人索引…</p>}><ArtistDirectory /></Suspense></SiteShell>;
}
