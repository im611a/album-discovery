import Link from "next/link";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PlaceholderPageProps = {
  activePath: "/discover" | "/new-releases" | "/search";
  title: string;
  description: string;
};

export function PlaceholderPage({
  activePath,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="site-shell">
      <SiteHeader activePath={activePath} />
      <main className="placeholder-main page-container" id="main-content">
        <p className="eyebrow">后续阶段</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="text-link" href="/">
          ← 返回首页
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
