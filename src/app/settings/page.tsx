import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { catalogRefreshDate } from "@/catalog/published-catalog";
export const metadata: Metadata = { title: "关于与设置 · 专辑发现" };
export default function SettingsPage() { return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><header className="page-intro"><p className="eyebrow">透明的数据边界</p><h1>关于与设置</h1><p>目录刷新于 {catalogRefreshDate}。正常浏览只读取随站点发布的静态快照。</p></header><SettingsPanel /><section className="settings-card"><h2>数据来源与限制</h2><p>专辑身份、发行日期与代表版曲目来自 MusicBrainz。封面优先尝试 Cover Art Archive；本快照因源站不可达使用本站生成式回退。中文导览与发现分类为原创 metadata-based 内容，尚未标记为人工策展评论。</p><p>本站不抓取 RYM，不展示虚构评分；网易云实验仅作为历史研究，不是运行依赖。直达按钮只在保存了经核验的公开链接时出现。</p></section></main><SiteFooter /></div>; }
