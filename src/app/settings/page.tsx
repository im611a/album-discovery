import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { catalogRefreshDate } from "@/catalog/published-catalog";
export const metadata: Metadata = { title: "关于与设置 · 专辑发现" };
export default function SettingsPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">本机偏好</p><h1>关于与设置</h1><p>目录刷新于 {catalogRefreshDate}。正常浏览只读取随站点发布的静态快照。</p></header><SettingsPanel /></main><SiteFooter /></div>; }
