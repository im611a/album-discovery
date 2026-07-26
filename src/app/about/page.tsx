import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";

export default function AboutPage() {
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-reading-page" id="main-content">
    <header className="page-intro"><p className="eyebrow">Album Discovery Archive</p><h1>关于本站</h1><p>这是一个面向中文读者的静态专辑档案与发现工具：用真实目录、可说明的分类和本机偏好，帮助你找到下一张值得完整聆听的专辑。</p></header>
    <div className="about-editorial">
      <section><p className="section-kicker">目录</p><h2>{catalogAlbums.length} 张专辑，{publishedArtists.length} 位艺人</h2><p>页面只读取随网站发布的本地快照，不会在浏览时请求音乐数据服务。缺失的评分或分类保持缺失，不用推测值补齐。</p></section>
      <section><p className="section-kicker">个人状态</p><h2>只保存在当前设备</h2><p>想听、喜欢、听过、收藏、不适合与口味设置均保存在浏览器本机；本站没有账号系统，也不会上传这些选择。</p></section>
      <section><p className="section-kicker">收听</p><h2>回到专辑，而不是播放器</h2><p>本站不提供站内播放。专辑详情给出曲目与来源边界，并通过明确的网易云外链进入正式收听页面。</p></section>
    </div>
    <nav className="topic-return-links" aria-label="继续浏览"><Link href="/discover">浏览专辑目录</Link><Link href="/explore">换一种方式探索</Link><Link href="/settings">查看隐私与设置</Link></nav>
  </main><SiteFooter /></div>;
}
