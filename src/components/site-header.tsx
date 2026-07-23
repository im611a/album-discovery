"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE_NAME } from "@/lib/site";

const navigation = [
  ["/", "首页"], ["/discover", "发现"], ["/for-you", "为你推荐"], ["/new-releases", "最近收录"], ["/artists", "艺人"], ["/library", "我的专辑"], ["/search", "搜索"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return <>
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="site-header"><div className="page-container site-header__inner">
      <Link className="site-brand" href="/" aria-label={`${SITE_NAME}首页`}><span className="site-brand__mark" aria-hidden="true" /><span>{SITE_NAME}</span></Link>
      <button ref={buttonRef} className="mobile-menu-button" type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">{open ? "×" : "☰"}</span><span className="visually-hidden">{open ? "关闭菜单" : "打开菜单"}</span></button>
      <nav id="primary-navigation" className="primary-nav" data-open={open ? "true" : "false"} aria-label="主导航">{navigation.map(([href, label], index) => <Link ref={index === 0 ? firstLinkRef : undefined} key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "page" : undefined}>{label}</Link>)}</nav>
      <Link className="settings-entry" href="/settings" onClick={() => setOpen(false)} aria-current={pathname === "/settings" ? "page" : undefined}>设置</Link>
    </div></header>
  </>;
}
