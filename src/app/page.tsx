import Link from "next/link";
import { AlbumGrid } from "@/components/album-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TasteSetup } from "@/components/taste/taste-setup";
import { catalogAlbums, catalogRefreshDate } from "@/catalog/published-catalog";
import { getEditorialPicks, getRecentlyAdded } from "@/catalog/queries";

const contextLinks = ["夜晚", "专注聆听", "通勤", "放松", "工作", "运动"];
export default function Home() {
  return <div className="site-shell"><SiteHeader /><main id="main-content">
    <section className="hero page-container"><p className="eyebrow">完整专辑，不是无限滑动</p><h1>找到下一张值得从头听到尾的专辑。</h1><p className="hero__lead">从中文音乐出发，用不到一分钟表达口味，获得有具体理由的专辑推荐；想听、喜欢和听过记录只留在本机。</p><div className="hero__actions"><Link className="button button--primary" href="/for-you">开始推荐</Link><Link className="button button--secondary" href="/discover">浏览 {catalogAlbums.length} 张专辑</Link></div><dl className="hero__facts"><div><dt>{catalogAlbums.length}</dt><dd>张网易云目录专辑</dd></div><div><dt>{catalogAlbums.filter((album) => album.editorial).length}</dt><dd>份中文导览</dd></div><div><dt>0</dt><dd>个必需账号</dd></div></dl></section>
    <div className="page-container home-flow"><TasteSetup embedded />
      <section className="catalog-section"><header className="section-heading"><div><p className="section-kicker">编辑入口</p><h2>从一张有导览的专辑开始</h2><p>每张都包含具体聆听提示、场景和经核验的外部去向。</p></div><Link href="/discover?guide=1">查看全部</Link></header><AlbumGrid albums={getEditorialPicks(6)} headingLevel={3} /></section>
      <section className="context-section"><header className="section-heading"><div><p className="section-kicker">此刻想怎么听</p><h2>按聆听场景发现</h2></div></header><div className="context-links">{contextLinks.map((context) => <Link key={context} href={`/discover?context=${encodeURIComponent(context)}`}>{context}<span aria-hidden="true">→</span></Link>)}</div></section>
      <section className="catalog-section"><header className="section-heading"><div><p className="section-kicker">静态目录 · {catalogRefreshDate}</p><h2>最近收录</h2><p>表示加入本站快照的时间，不冒充实时发行榜。</p></div><Link href="/new-releases">查看全部</Link></header><AlbumGrid albums={getRecentlyAdded(6)} headingLevel={3} /></section>
      <section className="product-note"><p className="section-kicker">我们做什么</p><h2>把选择解释清楚，再把聆听交给网易云音乐。</h2><p>专辑目录来自构建前生成的网易云本地快照；核心流派、相关流派和氛围特征为本站策展层。浏览过程不实时请求音乐平台，也不展示未经核验的平台统计。</p></section>
    </div>
  </main><SiteFooter /></div>;
}
