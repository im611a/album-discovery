# V1.1 视觉迁移图

| 旧表达 | 新表达 | 真实实现 |
|---|---|---|
| 首页载入即显示全部封面 | 静默文字开场，滚动可逆揭示 | `src/app/page.tsx`、`editorial-motion.tsx` |
| 一次性区块 reveal | A/B/C/D 四级页面动效 | `route-motion.tsx`、`globals.css` |
| 固定九宫式编辑画布 | 配置驱动的两章空间画廊 | `src/config/editorial-home.ts` |
| 静态精选章节 | 三章滚动同步 Deck 与活动黑胶 | `editorial-home-sections.tsx` |
| 通用页尾 | 目录规模、专题与运行边界档案页尾 | `site-footer.tsx` |
| 搜索专辑网格 | 紧凑专辑行与艺人档案行 | `search-catalog.tsx`、`artist-editorial-row.tsx` |
| 艺人索引三封面堆叠 | 每人默认一张缩略封面 | `artist-card.tsx` |
| 艺人详情只有文字 Hero | 2–5 张真实作品封面组合 | `artists/[slug]/page.tsx` |
| 详情页强调按钮式外链 | 明确平台名称的编辑型外链 | `album-detail.tsx` |
| 通用 404 文案 | “未找到该档案”与三个真实出口 | `not-found.tsx` |

没有迁移的契约：正式目录、推荐、本机状态 schema、URL 参数、分页、静态路由、
Metadata、Sitemap、同步与发布数据边界。
