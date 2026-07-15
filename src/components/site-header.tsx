import { SITE_NAME } from "@/lib/site";
import Link from "next/link";

type SiteHeaderProps = {
  activePath?: "/" | "/discover" | "/new-releases" | "/search";
};

const primaryNavigation = [
  { href: "/", label: "首页" },
  { href: "/discover", label: "发现专辑" },
  { href: "/new-releases", label: "新发行" },
] as const;

export function SiteHeader({ activePath }: SiteHeaderProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="site-header__inner page-container">
          <Link className="site-brand" href="/" aria-label={`${SITE_NAME}首页`}>
            <span className="site-brand__mark" aria-hidden="true" />
            <span>{SITE_NAME}</span>
          </Link>
          <nav className="primary-nav" aria-label="主导航">
            {primaryNavigation.map((item) => (
              <Link
                aria-current={activePath === item.href ? "page" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            aria-current={activePath === "/search" ? "page" : undefined}
            aria-label="搜索专辑和艺术家"
            className="search-entry"
            href="/search"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <span>搜索</span>
          </Link>
        </div>
      </header>
    </>
  );
}
