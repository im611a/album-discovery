import { Suspense } from "react";

import { NewReleasesCatalog } from "@/components/new-releases/new-releases-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { albumsMock } from "@/data/albums.mock";
import { newReleaseSourceContextMock } from "@/data/new-releases.mock";

export default function NewReleasesPage() {
  return (
    <div className="site-shell">
      <SiteHeader activePath="/new-releases" />
      <main className="new-releases-main page-container" id="main-content">
        <header className="new-releases-intro">
          <p className="eyebrow">本地静态原型</p>
          <h1>新发行</h1>
          <p>
            当前内容均为本地虚构原型数据。频道名称模拟网易云新发行市场频道，
            但不表示任何国籍、语言、法域或真实地区分类。
          </p>
        </header>

        <Suspense
          fallback={<p className="new-releases-loading">正在准备本地新发行列表…</p>}
        >
          <NewReleasesCatalog
            albums={albumsMock}
            sources={newReleaseSourceContextMock}
          />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
