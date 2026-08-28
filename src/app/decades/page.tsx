import Link from "next/link";
import { SiteShell } from "@/components/site-primitives";

export default function DecadesPage() {
  return <SiteShell mainClassName="pa-taxonomy-handoff">
    <header className="page-intro" data-page-family="utility"><p className="eyebrow">CHRONOLOGY / COMPATIBILITY</p><h1>年代浏览已合并到专辑目录</h1><p>年代现在是 Discover 的高级筛选条件，不再作为独立主页面。旧地址仍保留这一兼容入口。</p></header>
    <Link className="button button--primary" href="/discover">在目录中选择年代</Link>
  </SiteShell>;
}
