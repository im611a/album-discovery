import { Suspense } from "react";
import { ArtistDirectory } from "@/components/artists/artist-directory";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ArtistsPage() {
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">目录中的创作者</p><h1>艺人</h1><p>按名称或本站收录专辑数量浏览艺人。这里不展示虚构简介、照片、热度或排名。</p></header><Suspense fallback={<p className="status-message">正在准备艺人索引…</p>}><ArtistDirectory /></Suspense></main><SiteFooter /></div>;
}
