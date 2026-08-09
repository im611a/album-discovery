import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SiteShell } from "@/components/site-primitives";
import { catalogRefreshDate } from "@/catalog/published-catalog";
export const metadata: Metadata = { title: "关于与设置 · 专辑发现" };
export default function SettingsPage() { return <SiteShell mainClassName="pa-reading-page pa-settings-page r12-settings-page"><header className="r12-settings-utility-header" data-opening-role="local-utility"><div><p className="eyebrow">LOCAL UTILITY</p><h1>关于与设置</h1></div><p><strong>本机数据与偏好</strong><span>导入、导出、重置和口味设置只作用于当前浏览器。</span></p><time dateTime={catalogRefreshDate}>目录快照 {catalogRefreshDate}</time></header><SettingsPanel /></SiteShell>; }
