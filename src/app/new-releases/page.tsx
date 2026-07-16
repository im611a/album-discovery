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
            当前为本地虚构数据；频道名称来自网易云新发行列表，仅用于浏览新碟。
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
