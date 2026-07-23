import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="not-found-main page-container" id="main-content">
        <p className="eyebrow">404 · 静态目录</p>
        <h1>没有找到这个页面</h1>
        <p>这个地址不在当前已发布目录中，可以返回发现页继续浏览专辑与艺人。</p>
        <div className="not-found-actions">
          <Link className="button button--secondary" href="/discover">
            返回发现专辑
          </Link>
          <Link className="button button--quiet" href="/">
            返回首页
          </Link>
          <Link className="button button--quiet" href="/artists">
            浏览艺人
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
