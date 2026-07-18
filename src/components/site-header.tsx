"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";

const navigation = [
  ["/", "首页"], ["/discover", "发现"], ["/for-you", "为你推荐"], ["/new-releases", "最近收录"], ["/library", "我的专辑"], ["/search", "搜索"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  return <>
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="site-header"><div className="page-container site-header__inner">
      <Link className="site-brand" href="/" aria-label={`${SITE_NAME}首页`}><span className="site-brand__mark" aria-hidden="true" /><span>{SITE_NAME}</span></Link>
      <nav className="primary-nav" aria-label="主导航">{navigation.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "page" : undefined}>{label}</Link>)}</nav>
      <Link className="settings-entry" href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}>关于</Link>
    </div></header>
  </>;
}
