import type { Metadata } from "next";
import { LibraryCatalog } from "@/components/library/library-catalog";
import { PageHeader, SiteShell } from "@/components/site-primitives";
export const metadata: Metadata = { title: "我的专辑 · 专辑发现", description: "当前设备上的想听、喜欢、收藏、听过和不适合专辑。" };
export default function LibraryPage() { return <SiteShell mainClassName="pa-library r12-library"><PageHeader eyebrow="LOCAL LISTENING ARCHIVE" title="我的专辑" className="pa-library__intro r12-page-intro--compact" family="personal">想听、喜欢、收藏、听过与不适合你的专辑都只保存在当前设备。</PageHeader><LibraryCatalog /></SiteShell>; }
