import Link from "next/link";
import { AlbumGrid } from "@/components/album-grid";
import { HomeRecommendations } from "@/components/home/home-recommendations";
import { RandomDiscovery } from "@/components/home/random-discovery";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TasteSetup } from "@/components/taste/taste-setup";
import { catalogAlbums, catalogRefreshDate, getTaxonomyLabel } from "@/catalog/published-catalog";
import { buildDiscoverOptions, getRecentlyAdded } from "@/catalog/queries";

const genreLinks = buildDiscoverOptions().coreGenres.slice(0, 8);

export default function Home() {
  return <div className="site-shell"><SiteHeader /><main id="main-content">
    <section className="hero page-container"><p className="eyebrow">完整专辑，不是无限滑动</p><h1>找到下一张值得从头听到尾的专辑。</h1><p className="hero__lead">从中文音乐出发，用不到一分钟表达口味，获得有具体理由的专辑推荐；想听、喜欢、收藏和听过记录只留在本机。</p><div className="hero__actions"><Link className="button button--primary" href="/for-you">开始推荐</Link><Link className="button button--secondary" href="/discover">浏览 {catalogAlbums.length} 张专辑</Link></div><dl className="hero__facts"><div><dt>{catalogAlbums.length}</dt><dd>张网易云目录专辑</dd></div><div><dt>{catalogAlbums.filter((album) => album.editorial).length}</dt><dd>份中文导览</dd></div><div><dt>0</dt><dd>个必需账号</dd></div></dl></section>
    <div className="page-container home-flow"><TasteSetup embedded />
      <section className="catalog-section"><header className="section-heading"><div><p className="section-kicker">本机计算 · 可解释</p><h2>为你推荐</h2><p>只根据你主动选择和保存的状态计算，不使用未经核验的平台统计。</p></div><Link href="/for-you">查看全部</Link></header><HomeRecommendations /></section>
      <section className="catalog-section"><header className="section-heading"><div><p className="section-kicker">静态目录 · {catalogRefreshDate}</p><h2>最近收录</h2><p>表示加入本站快照的时间，不冒充实时发行榜。</p></div><Link href="/new-releases">查看全部</Link></header><AlbumGrid albums={getRecentlyAdded(6)} headingLevel={3} /></section>
      <section className="context-section"><header className="section-heading"><div><p className="section-kicker">稳定分类入口</p><h2>按核心流派发现</h2></div><Link href="/discover">全部筛选</Link></header><div className="context-links">{genreLinks.map((genre) => <Link key={genre} href={`/discover?genre=${encodeURIComponent(genre)}`}>{getTaxonomyLabel(genre)}<span aria-hidden="true">→</span></Link>)}</div></section>
      <section className="catalog-section"><header className="section-heading"><div><p className="section-kicker">不依赖外部请求</p><h2>随机发现</h2><p>从当前本地目录中换一个起点。</p></div></header><RandomDiscovery /></section>
      <section className="product-note"><p className="section-kicker">我们做什么</p><h2>把选择解释清楚，再把聆听交给网易云音乐。</h2><p>专辑目录来自构建前生成的网易云本地快照；未匹配 RYM 的专辑只保留人工确认的核心流派，相关流派与社区评分仅发布可靠离线 RYM 匹配值。浏览过程不实时请求音乐平台，也不展示未经核验的平台统计。</p><Link href="/artists">浏览艺人目录 →</Link></section>
    </div>
  </main><SiteFooter /></div>;
}
