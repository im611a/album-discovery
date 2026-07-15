import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="not-found-main page-container" id="main-content">
        <p className="eyebrow">404 · 本地目录</p>
        <h1>没有找到这张专辑</h1>
        <p>这个地址不在当前虚构专辑目录中，可以返回目录继续浏览。</p>
        <div className="not-found-actions">
          <Link className="secondary-button" href="/discover">
            返回发现专辑
          </Link>
          <Link className="text-link" href="/">
            返回首页
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
