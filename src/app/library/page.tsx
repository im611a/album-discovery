import type { Metadata } from "next";
import { LibraryCatalog } from "@/components/library/library-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
export const metadata: Metadata = { title: "我的专辑 · 专辑发现", description: "当前设备上的想听、喜欢、听过和不适合专辑。" };
export default function LibraryPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">只保存在当前设备</p><h1>我的专辑</h1><p>整理想听、喜欢、听过与不适合你的专辑，不需要账号。</p></header><LibraryCatalog /></main><SiteFooter /></div>; }
