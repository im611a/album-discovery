# V1.1 全站页面验收矩阵

状态：`READY_FOR_HUMAN_REVIEW`

证据保存在被忽略的 `.local-data/v1.1-full-site-acceptance/`。`VERIFIED` 表示桌面和手机
截图、唯一 h1、横向溢出、console 与相关自动行为已核验；它不表示用户人工验收。

| # | 页面/场景 | 样例路由 | 原型/等级 | 桌面与手机证据 | 功能/键盘/溢出 | 状态 |
|---:|---|---|---|---|---|---|
| 1 | 首页普通动效首屏 | `/` | immersive-gallery / A | `home-initial.png`、移动录像 | motion + product E2E | VERIFIED |
| 2 | 首页滚动中段 | `/` | immersive-gallery / A | `home-gallery-complete.png`、keyframes | 可逆滚动、几何 | VERIFIED |
| 3 | 首页三章重点专辑 | `/` | immersive-gallery / A | `home-deck-01..03.png`、录像 | activeIndex 同步 | VERIFIED |
| 4 | 首页 reduced-motion | `/` | immersive-gallery / A | 视觉基准 7 视口 | 静态顺序、无旋转 | VERIFIED |
| 5 | 首页无 JavaScript | `/` | immersive-gallery / A | Playwright DOM 证据 | 标题与链接可达 | VERIFIED |
| 6 | 发现默认 | `/discover/` | editorial-tool / C | `03-discover-*` | 筛选、分页、键盘 | VERIFIED |
| 7 | 发现组合筛选 | `/discover/?genre=pop` | editorial-tool / C | `04-discover-filter-*` | URL、返回、结果 | VERIFIED |
| 8 | 搜索初始 | `/search/` | editorial-search / C | `05-search-*` | form、Enter、清空 | VERIFIED |
| 9 | 搜索结果与无结果 | `/search/?q=Radiohead` | editorial-search / C | `06/07-search-*` | 40 条分页、URL | VERIFIED |
| 10 | 探索 | `/explore/` | editorial-tool / C | `08-explore-*` | 种子与真实链接 | VERIFIED |
| 11 | 为你推荐冷启动 | `/for-you/` | editorial-tool / C | `09-for-you-*` | 推荐理由与状态 | VERIFIED |
| 12 | 为你推荐有状态 | `/for-you/` | editorial-tool / C | 页面矩阵证据 | 本机状态 Vitest/E2E | VERIFIED |
| 13 | 最近收录 | `/new-releases/` | editorial-tool / C | `10-recent-*` | 频道、类型、URL | VERIFIED |
| 14 | 我的专辑空状态 | `/library/` | editorial-tool / C | `11-library-*` | 明确下一步 | VERIFIED |
| 15 | 我的专辑有状态 | `/library/?state=wantToListen` | editorial-tool / C | `28-library-want-*` | 状态筛选 | VERIFIED |
| 16 | 艺人索引 | `/artists/` | artist-archive / C | `12-artists-*` | 一封面、详情链接 | VERIFIED |
| 17 | 多作品艺人详情 | `/artists/artist-6452/` | artist-profile / B | `13-artist-feature-*` | 代表封面组合 | VERIFIED |
| 18 | 少量作品艺人详情 | `/artists/artist-12127888/` | artist-profile / B | `14-artist-small-*` | 数量自适应 | VERIFIED |
| 19 | 专辑详情有评分 | `/albums/ok-computer/` | album-essay / B | `15-album-rating-*` | RYM、曲目、外链 | VERIFIED |
| 20 | 专辑详情无评分 | `/albums/wake-after-the-rain/` | album-essay / B | `16-album-no-rating-*` | 诚实缺失 | VERIFIED |
| 21 | 专辑详情长标题/曲目 | `/albums/netease-1678569/` | album-essay / B | `17-album-long-*` | 无文字覆盖 | VERIFIED |
| 22 | 核心流派索引 | `/genres/` | topic-hub / C | `18-genres-*` | 专题链接 | VERIFIED |
| 23 | 核心流派专题 | `/genres/core/pop/` | topic-hub / B | `19-core-topic-*` | 网格、分页 | VERIFIED |
| 24 | 相关流派专题 | `/genres/related/ambient/` | topic-hub / B | `20-related-topic-*` | 真实分类 | VERIFIED |
| 25 | 聆听场景索引/专题 | `/scenes/`、`/scenes/night/` | topic-hub / B/C | `21/22-scene-*` | 链接、结果 | VERIFIED |
| 26 | 年代索引/专题 | `/decades/`、`/decades/2000s/` | topic-hub / B/C | `23/24-decade-*` | 链接、结果 | VERIFIED |
| 27 | 设置导入导出/重置 | `/settings/` | utility-minimal / D | `25-settings-*` | 本机状态完整测试 | VERIFIED |
| 28 | 关于 | `/about/` | utility-minimal / D | `26-about-*` | 真实边界说明 | VERIFIED |
| 29 | 未知专辑 404 | `/albums/not-a-real-album/` | utility-minimal / D | `27-not-found-*` | 三个真实出口 | VERIFIED |
| 30 | 页头、页尾与移动菜单 | 全局 | global | 全部 60 张矩阵图 | Esc、焦点恢复、链接 | VERIFIED |

## 仍需用户人工确认

- 真实浏览器 UI 200% 缩放无法由当前 Playwright 环境可靠设置，状态为 `PARTIAL`；
  1280/1024/768 压力测试不是它的替代物。
- WebKit 是 Safari 近似；Firefox 若受本机 SWGL 限制则单独记为 `PARTIAL`。
- 最终唯一目录 HTTP 预览必须由用户自行查看后，才能改变
  `humanVisualAcceptance: "pending"`。
