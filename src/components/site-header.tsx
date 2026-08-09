"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import { isNavigationItemActive, siteNavigationGroups } from "@/components/site-navigation";

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
      <Link className="site-brand" href="/" aria-label={`${SITE_NAME}首页`}><span>{SITE_NAME}</span><small>Album Discovery Archive</small></Link>
      <button ref={buttonRef} className="mobile-menu-button" type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">{open ? "×" : "☰"}</span><span className="visually-hidden">{open ? "关闭菜单" : "打开菜单"}</span></button>
      <nav id="primary-navigation" className="primary-nav" data-open={open ? "true" : "false"} aria-label="主导航">{siteNavigationGroups.map((group, groupIndex) => <div className="primary-nav__group" key={group.label}><span>{group.label}</span><div>{group.items.map(([href, label], itemIndex) => <Link ref={groupIndex === 0 && itemIndex === 0 ? firstLinkRef : undefined} key={href} href={href} onClick={() => setOpen(false)} aria-current={isNavigationItemActive(pathname, href) ? "page" : undefined}>{label}</Link>)}</div></div>)}</nav>
    </div></header>
  </>;
}
