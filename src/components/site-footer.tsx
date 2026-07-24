import Link from "next/link";
import { catalogRefreshDate } from "@/catalog/published-catalog";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer"><div className="page-container site-footer__inner">
    <div><p className="site-footer__brand">{SITE_NAME}</p><p>Album Discovery Archive</p></div>
    <nav aria-label="页尾目录"><Link href="/discover">专辑目录</Link><Link href="/artists">艺人档案</Link><Link href="/genres">流派专题</Link><Link href="/about">关于本站</Link></nav>
    <div><p>目录刷新于 {catalogRefreshDate}。</p><p>偏好与专辑状态只保存在当前设备。</p><Link href="/settings">隐私与设置 →</Link></div>
  </div></footer>;
}
