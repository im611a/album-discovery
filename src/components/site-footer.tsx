import Link from "next/link";
import { catalogAlbums, catalogRefreshDate, publishedArtists } from "@/catalog/published-catalog";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer"><div className="page-container site-footer__inner">
    <div><p className="site-footer__brand">{SITE_NAME}</p><p>Album Discovery Archive · V1.1</p><p>{catalogAlbums.length} 张专辑 / {publishedArtists.length} 位艺人</p></div>
    <nav aria-label="页尾目录"><Link href="/discover">专辑目录</Link><Link href="/artists">艺人档案</Link><Link href="/genres">流派专题</Link><Link href="/search">搜索档案</Link><Link href="/about">数据与本站</Link><Link href="/settings">隐私与设置</Link></nav>
    <div><p>目录刷新于 {catalogRefreshDate}。</p><p>运行时不请求音乐数据源。</p><p>偏好与专辑状态只保存在当前设备。</p></div>
  </div></footer>;
}
