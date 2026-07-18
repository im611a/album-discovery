import Link from "next/link";
import { catalogRefreshDate } from "@/catalog/published-catalog";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer"><div className="page-container site-footer__inner">
    <p>{SITE_NAME} · MusicBrainz 元数据 · 本地原创导览</p>
    <p>目录刷新于 {catalogRefreshDate}。偏好与专辑状态只保存在当前设备。</p>
    <Link href="/settings">数据来源、隐私与设置</Link>
  </div></footer>;
}
