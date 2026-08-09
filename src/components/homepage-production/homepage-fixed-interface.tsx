import Link from "next/link";
import { siteNavigationGroups } from "@/components/site-navigation";

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
              {group.items.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
            </div>
          ))}
        </nav>
      </header>
    </>
  );
}
