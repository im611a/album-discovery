import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-primitives";

export const metadata: Metadata = { title: "最近收录已合并到目录 · 专辑发现" };

export default function NewReleasesPage() {
  return <SiteShell mainClassName="ux-recent-compatibility"><section data-opening-role="ux-recent-compatibility" aria-labelledby="recent-compatibility-title"><p className="eyebrow">ROUTE COMPATIBILITY</p><h1 id="recent-compatibility-title">最近收录已合并到专辑目录</h1><p>该浏览方式不再作为独立产品页面维护。目录中的“最近收录”排序使用同一份静态专辑数据，并可由稳定网址直接打开。</p><Link href="/discover?sort=recently-added">按最近收录浏览目录 →</Link></section></SiteShell>;
}
