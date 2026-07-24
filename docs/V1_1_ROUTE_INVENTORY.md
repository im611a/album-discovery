# V1.1 路由与页面原型清单

状态：VERIFIED（基于真实 `src/app/**/page.tsx`、静态参数与现有 build）

| 原型 | 路由 | 运动等级 | 主要复用 |
|---|---|---|---|
| 首页沉浸画廊 | `/` | A | 编辑首页配置、真实封面、本机推荐 |
| 目录工具 | `/discover`、`/search`、`/artists`、`/explore`、`/for-you`、`/new-releases`、`/library` | C | page intro、筛选、分页、AlbumGrid |
| 专题索引 | `/genres`、`/scenes`、`/decades` | C | TopicIndex |
| 专题详情 | `/genres/core/[slug]`、`/genres/related/[slug]`、`/scenes/[slug]`、`/decades/[slug]` | B | TopicPage、TopicCatalog |
| 专辑详情 | `/albums/[slug]` | B | AlbumDetail、TrackList、ContinueExploring |
| 艺人详情 | `/artists/[slug]` | B | 艺人身份、关联 AlbumGrid |
| 最小信息页 | `/settings`、`/about`、404 | D | page intro、设置表单、返回链接 |

固定页面实际位于 `src/app/**/page.tsx`；动态页面由专辑、艺人、核心/相关流派、
场景和年代的 `generateStaticParams` 生成。robots 与 sitemap 分别位于
`src/app/robots.ts` 和 `src/app/sitemap.ts`。

当前已验证 build 为 661 个目录式静态页面。最终重建必须重新扫描
`out/**/index.html` 并核对 sitemap，不能沿用此数字作为最终事实。

## 必须保持的路由契约

- 发现、搜索、专题筛选与分页继续使用标准 `URLSearchParams`，刷新和历史导航可恢复。
- 所有专辑封面进入 `/albums/<slug>/`；艺人链接进入 `/artists/<slug>/`。
- 深层静态 URL 直接访问和刷新可用，未知专辑返回友好 404。
- 页面不得通过客户端运行时访问网易云、RYM 或其他音乐 Provider。
