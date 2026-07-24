# V1.1 全站编辑动效重建仓库事实

状态：VERIFIED  
实现基线：`feat/v1.1-visual-redesign` / `f8747632c11c5c9b076ed3d086d723b7dfb247a7`
工作分支：`fix/v1.1-full-site-editorial-motion-rebuild`

## Git 与封存

- main 仍为 `1573ebac30ea84d438570fe7f85626cdf98f7ff3`。
- `v1.0.0-local` 解引用后仍指向 `fbb989147ea7f05a38d5b5570ce130c41a996d68`。
- V1 外部封存位于 `D:\Projects\album-discovery-releases\v1.0.0-local`。
- 既有 stash 为 `backup: legacy v0.2 plan before 0.2P`，本任务不操作。

## 工程与依赖

| 事实 | 证据 |
|---|---|
| Next.js 16.2.10、React 19.2.4、静态导出、目录式路由 | `package.json`、`next.config.ts` |
| Anime.js 4.5.0 是唯一运行时动画引擎 | `package.json`、`pnpm-lock.yaml` |
| Playwright 1.61.1 已配置 Chromium、Firefox、WebKit | `package.json`、`playwright.config.ts` |
| 根布局为 Server Component | `src/app/layout.tsx` |
| Tailwind 4 入口与主要手写样式集中在全局文件 | `postcss.config.mjs`、`src/app/globals.css` |
| 没有 Motion、Framer Motion、GSAP、Three 或 WebGL 依赖 | `package.json`、锁文件搜索 |

## 重建后的事实

- `EditorialMotion` 提供可逆滚动揭示、按需单 RAF 指针深度、共享 Deck `activeIndex`、
  活动黑胶、隐藏页签状态和内部导航返回位置恢复。
- 普通桌面模式首帧封面数为 0；reduced-motion、无 JavaScript 和视觉测试模式输出安全静态流。
- 九个封面的色组、尺度、深度、指针强度、角度、层级和重叠许可由
  `src/config/editorial-home.ts` 统一管理。
- `RouteMotion` 是放在 Server Root Layout 内的局部客户端岛，只对 B/C 页面做有限进入。
- Playwright 已增加运动、三视口五指针几何、30 场景双视口页面矩阵、连续录像和静态视觉证据。
- 静态导出新增全 HTML 内部链接和本地资源扫描，发布清单包含 V1.1 重建状态与
  `humanVisualAcceptance: "pending"`。

## 稳定复用点

- 全局导航、移动菜单和 Esc：`src/components/site-header.tsx`。
- 封面与缺图：`src/components/albums/album-cover.tsx`。
- 目录卡片、操作和网格：`src/components/album-card.tsx`、`album-actions.tsx`、`album-grid.tsx`。
- 首页配置与编辑组件：`src/config/editorial-home.ts`、`src/components/editorial/**`。
- 详情、艺人、筛选、搜索、专题、推荐和本机状态均已有稳定组件；本任务只改变视觉表达和局部动效边界。
- 静态链接、打包与发布脚本位于 `scripts/**`，不建立第二套交付系统。

## 数据与静态规模

- 319 张专辑、274 位艺人、13 张有 RYM 评分、11 张有相关流派、15 个核心流派、24 个相关流派、7 个聆听场景。
- 现有 build 生成 661 个目录式静态页面；详情和艺人路由在构建期生成。
- 正式页面只消费本地快照和本地 WebP，不向音乐 Provider 发起运行时请求。

## 性能比较基线

`f874763` 首页静态 HTML 关联 11 个 JavaScript 资源（1,092,502 字节）、1 个 CSS
资源（46,083 字节）和 33 个图片元素。重建必须解释增长，禁止视频、WebGL、远程字体、
远程图片和第二动画引擎。
