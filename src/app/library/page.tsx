import type { Metadata } from "next";
import { Suspense } from "react";
import { LIBRARY_PAGE_IDENTITY } from "@/catalog/library-presentation-model";
import { LibraryCatalog } from "@/components/library/library-catalog";
import { PageHeader, SiteShell } from "@/components/site-primitives";

export const metadata: Metadata = {
  title: "我的专辑 · 专辑发现",
  description: "回到当前设备上明确保留或最近查看的真实专辑。",
};

export default function LibraryPage() {
  return (
    <SiteShell mainClassName="pa-library r12-library r15-library">
      <PageHeader
        eyebrow={LIBRARY_PAGE_IDENTITY.eyebrow}
        title={LIBRARY_PAGE_IDENTITY.title}
        className="pa-library__intro r15-library__intro"
        family="personal"
      >
        {LIBRARY_PAGE_IDENTITY.description}
      </PageHeader>
      <Suspense fallback={<div className="r15-library-loading" role="status"><span aria-hidden="true">00</span><p>正在准备当前设备上的专辑清单…</p></div>}>
        <LibraryCatalog />
      </Suspense>
    </SiteShell>
  );
}
