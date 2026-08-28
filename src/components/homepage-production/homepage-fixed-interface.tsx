import Link from "next/link";
import { siteNavigationGroups } from "@/components/site-navigation";
import { GlobalSearchTrigger } from "@/components/search/global-search";

export function HomepageFixedInterface() {
  return (
    <>
      <a className="ad-skip-link" href="#homepage-gallery">跳到专辑画廊</a>
      <header className="ad-header">
        <Link className="ad-brand" href="/" aria-label="专辑发现首页">ALBUM DISCOVERY</Link>
        <nav className="ad-nav" aria-label="主要导航">
          {siteNavigationGroups.map((group) => (
            <div className="ad-nav__column" key={group.label}>
              <span className="ad-nav__label">{group.label}</span>
              {group.items.map((item) => item.kind === "link" ? <Link href={item.href} key={item.href}>{item.label}</Link> : <GlobalSearchTrigger key="global-search">{item.label}</GlobalSearchTrigger>)}
            </div>
          ))}
        </nav>
      </header>
    </>
  );
}
