# V1.1 全站编辑动效重建实施契约

## 当前状态

`CURRENT_V1_1_VISUAL_ACCEPTANCE = READY_FOR_HUMAN_REVIEW`

上一版提交 `f8747632c11c5c9b076ed3d086d723b7dfb247a7` 未通过人工视觉验收。本分支只能在全部自动检查与内部浏览器证据完成后进入
`READY_FOR_HUMAN_REVIEW`，不得写成人工已验收。

| 工作流 | 状态 |
|---|---|
| 事实、契约、路由清单与 Skills | VERIFIED |
| 参考站有限运动观察 | VERIFIED |
| 首页编辑动效场景 | VERIFIED |
| 全站页面视觉扩展 | VERIFIED |
| 浏览器、可访问性与运动回归 | PARTIAL |
| 静态交付与独立最终审计 | VERIFIED |

状态只允许 `NOT_STARTED`、`IN_PROGRESS`、`VERIFIED`、`PARTIAL`、`BLOCKED`。

浏览器回归的 `PARTIAL` 仅来自无法自动设置真实浏览器 UI 200% 缩放，以及 Firefox
在本机图形启动阶段超时；Chromium 完整范围和 WebKit 关键范围已有实际证据。

## LOCKED

- 319 张正式目录、274 位艺人、网易云身份、离线 RYM 值、同步、推荐、本机状态和 URL 契约。
- V1 标签 `v1.0.0-local`、main、stash 与外部 V1 封存目录。
- Next.js 静态导出、轻量索引、独立详情、分页、深层路由与发布原子替换。
- 根布局保持 Server Component；浏览器音乐 Provider 请求保持 0。
- 不增加播放器、账号、评论、热度、地区推断、“氛围与特征”或第二动画引擎。

## DERIVED

- 首页为 A 级沉浸动效；艺人详情、专辑详情和重点专题为 B 级叙事动效；目录工具页为 C 级轻动效；设置、关于与 404 为 D 级最小动效。
- 首页首屏默认先输出稳定文字和蓝黑背景，普通动效模式下封面随滚动逐步出现并可逆；无 JavaScript、reduced-motion 与视觉测试模式直接显示可用静态内容。
- 桌面指针视差使用单个按需 RAF；指针静止后停止，不劫持滚动。
- 三张重点专辑共享一个 `activeIndex`，序号、标题、封面与唱片同步；只有活动唱片旋转，隐藏页签、非活动、reduced-motion 时停止。
- 首页布局、运动层级和封面色组集中配置；页面不得复制目录数据。
- 全站通过共享 Token、页头、页尾、页面原型和有限客户端岛统一，不把工具页改成自由画布。

## OPTIONAL

- 仅当浏览器证据证明可读性与性能不受损时，使用轻微深度、标题擦入和章节进度。
- 参考站可用时完成有限截图与交互观察；不可用时如实标记 `PARTIAL`，不复制源码或素材。
- Firefox 在当前图形环境无法启动时可标记 `PARTIAL`；Chromium 与 WebKit 仍必须完成规定范围。

## REJECTED

- 复制参考站 HTML、CSS、JavaScript、字体、图片、Logo 或品牌资产。
- Motion、Framer Motion、GSAP、Three、WebGL、粒子、滚动劫持、永久 RAF、无界循环。
- React Bits、Aceternity UI、Uiverse 或其他新运行时 UI 依赖；现有 CSS、React 与 Anime.js 足以实现。
- 大面积玻璃拟态、霓虹、播放器拟态、虚假唱片控制、远程字体和远程图片。

## 页面与运动等级

| 等级 | 页面 | 契约 |
|---|---|---|
| A | `/` | 滚动揭示画廊、按需指针视差、滚动同步三章、活动唱片 |
| B | `/albums/[slug]`、`/artists/[slug]`、核心/相关流派、场景、年代专题详情 | 有限叙事进入与章节层级，不持续运行 |
| C | `/discover`、`/search`、`/artists`、`/explore`、`/for-you`、`/new-releases`、`/library`、专题索引 | 清晰工具结构、轻量进入、完整 URL 与键盘行为 |
| D | `/settings`、`/about`、404 | 静态优先，仅保留必要反馈 |

## 全局实现规则

1. `src/app/layout.tsx` 不添加 `"use client"`；动效只进入局部客户端边界。
2. 运行时唯一动画引擎为 Anime.js 4.5.0，使用 `createScope` 并在卸载时 `scope.revert()`。
3. 所有内容在动画失败时仍可见；无 JS 与 reduced-motion 不依赖 opacity 初始隐藏。
4. 动效只服务层级、空间与状态，不改变 DOM 阅读顺序或阻挡链接。
5. 重点交互必须有键盘、focus-visible、reduced-motion 和静态回退。
6. 页面原型优先复用 `SiteHeader`、`SiteFooter`、`AlbumCover`、`AlbumCard`、`AlbumGrid`、分页与本机状态组件。
7. 不新增运行时依赖，不修改目录快照、同步或推荐算法。

## 测试与证据

- Vitest：配置完整性、客户端边界、清理、按需 RAF、滚动/指针状态、活动索引、静态回退和页面语义。
- Playwright Chromium：功能、七个视口、正常动效、reduced-motion、无 JS、隐藏页签、网络、console、横向溢出、几何重叠与视觉基准。
- WebKit：关键功能与响应式冒烟。Firefox 尽力运行，环境失败必须记录原始错误。
- 证据只写入被忽略的 `.local-data/v1.1-full-site-acceptance/`；参考观察只写入被忽略的 `.local-data/design-reference/meinhardtaxer-motion-atlas/`。
- 最终执行 `catalog:validate`、lint、typecheck、完整测试、build、Playwright、内部链接/资源扫描和 `git diff --check`。

## 发布状态

最终 release manifest 必须包含：

- `visualDesignVersion: "1.1-full-site-motion-rebuild"`
- `designSystem: "editorial-songti-motion"`
- `animationEngine: "animejs"`
- `homeIntro: "scroll-reveal"`
- `pointerParallax: true`
- `featuredAlbumDeck: "scroll-synced"`
- `activeVinylRotation: true`
- `fullSiteEditorialRedesign: true`
- `localStateSchemaCompatible: true`
- `internalLinksValidated: true`
- `humanVisualAcceptance: "pending"`

## 停止条件

- 基线、main、stash、tag 或 V1 封存发生变化。
- 需要修改正式目录、同步、推荐、本机状态 schema 或引入第二动画引擎。
- 无法保持根布局为 Server Component。
- 质量门、静态链接扫描存在 Blocker/Major，或工作区无法恢复为干净提交状态。
