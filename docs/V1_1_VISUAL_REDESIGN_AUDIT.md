# V1.1 全站编辑动效重建审计

状态：`READY_FOR_HUMAN_REVIEW`
人工视觉验收：`pending`

## 事实与边界

- 起始提交：`f8747632c11c5c9b076ed3d086d723b7dfb247a7`。
- 工作分支：`fix/v1.1-full-site-editorial-motion-rebuild`。
- 目录保持 319 张专辑、274 位艺人、13 张 RYM 评分专辑、11 张相关流派专辑、
  15 个核心流派、24 个相关流派、7 个实际有数据的聆听场景。
- 正式目录、推荐算法、本机状态 schema、同步数据、main、stash、现有标签和 V1 封存未改。
- 新增运行时依赖 0；Anime.js 4.5.0 仍是唯一动画引擎。

## 需求处理结果

- 首页：普通桌面初始 0 张封面，滚动揭示可逆；五个指针位置产生不同深度位移；
  单 RAF 稳定后停止；三章 Deck 共用 activeIndex；活动黑胶旋转。
- 降级：无 JavaScript、reduced-motion、粗指针和视觉测试模式均有完整静态内容。
- 全站：发现、搜索、艺人、专辑、探索、推荐、最近收录、我的专辑、专题、设置、
  关于、404、Header 和 Footer 已纳入 A/B/C/D 页面原型。
- 艺人索引默认每人一张缩略封面；艺人详情使用 2–5 张真实作品封面。
- 搜索使用 `CompactAlbumRow` 与 `ArtistEditorialRow`；404 提供首页、发现、搜索。
- 静态扫描发现并修复首页“驾车”零数据场景的损坏链接；最终只渲染实际存在的 7 个场景。

## 自动证据

- Vitest：49 个文件、860 个用例。
- Chromium：产品、11 个视觉基准、6 个运动、3 个几何、30 个页面矩阵和 3 个证据任务。
- 页面矩阵：30 个场景 × 桌面/手机，共 60 张全页证据；唯一 h1、无横向溢出和 console
  审计通过。
- 几何：1280×800、1440×900、1920×1080，每个视口 5 个指针位置；所有
  `allowOverlap: false` 封面交集面积为 0。
- WebKit：关键产品路径、滚动揭示、Deck、reduced-motion 和无 JavaScript 通过。
- Firefox：本机图形启动阶段再次超时，记为环境 `PARTIAL`，没有伪报通过。
- 真实浏览器 UI 200% 缩放无法由当前自动化可靠设置，记为 `PARTIAL`。

## 证据位置

- 本站连续录像、关键帧和页面截图：
  `.local-data/v1.1-full-site-acceptance/`
- 参考站有限观察：
  `.local-data/design-reference/meinhardtaxer-motion-atlas/`
- 正式视觉基准：
  `tests/e2e/__screenshots__/chromium/`

参考观察只保存截图和非敏感几何/console 事实，没有保存对方 HTML、CSS、JavaScript、
字体、图片、Cookie 或品牌资源。

## 发布边界

`release-manifest.json` 必须记录 `1.1-full-site-motion-rebuild`、
`editorial-songti-motion`、滚动揭示、指针深度、滚动 Deck、活动黑胶、状态兼容、
内部链接已验证，以及 `humanVisualAcceptance: "pending"`。

最终判定：Blocker 0，Major 0。Firefox 与真实 200% 缩放是明确 Minor/PARTIAL；
它们不改变 Chromium、WebKit、静态构建和交付包的已验证事实。当前版本可以交给用户
进行人工视觉验收，但 Codex 不宣称用户已接受。
