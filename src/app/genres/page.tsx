import Link from "next/link";
import { SiteShell } from "@/components/site-primitives";

export default function GenresPage() {
  return <SiteShell mainClassName="pa-genre-index ux-genre-compatibility">
    <section aria-labelledby="genre-compatibility-title">
      <p className="eyebrow">CATALOG FILTER / COMPATIBILITY</p>
      <h1 id="genre-compatibility-title">流派已经回到专辑目录</h1>
      <p>核心流派与可靠的相关流派仍完整保留，但现在作为目录筛选条件使用，避免把分类本身做成另一套庞大入口。</p>
      <Link href="/discover">打开目录并选择流派 <span aria-hidden="true">→</span></Link>
    </section>
  </SiteShell>;
}
