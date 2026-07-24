# V1.1 仓库事实

状态：VERIFIED  
基线：`feat/v1.1-visual-redesign` / `fbb989147ea7f05a38d5b5570ce130c41a996d68`

## 工程与依赖

| 事实 | 证据 |
|---|---|
| Next.js 16.2.10，静态导出、目录式路由、非优化图片 | `package.json`、`next.config.ts` |
| React / React DOM 19.2.4 | `package.json` |
| TypeScript strict 与 `@/* → src/*` | `tsconfig.json` |
| Tailwind CSS 4 通过 `@import "tailwindcss"`；主要样式集中在单一全局文件 | `postcss.config.mjs`、`src/app/globals.css` |
| 当前没有 Anime.js 依赖 | `package.json`、`pnpm-lock.yaml` |
| 当前没有 Playwright 配置或 E2E；锁文件命中只是 Vitest/Next 的可选依赖元数据 | `package.json`、`pnpm-lock.yaml`、仓库文件搜索 |
| 当前 36 个 `src/**` Vitest 文件，完整测试还包括脚本测试 | `src/**/*.test.*`、`scripts/**/*.test.mjs` |

## 现有 UI 与复用点

- 全局 Header、移动菜单、Esc 关闭和当前路由状态：
  `src/components/site-header.tsx`。
- 唯一标准专辑展示、独立艺人/流派链接和本机操作：
  `src/components/album-card.tsx`、`src/components/album-actions.tsx`。
- 封面本地资源与 fallback：`src/components/albums/album-cover.tsx`。
- 六列到两列目录网格：`src/components/album-grid.tsx`。
- 详情、曲目、同艺人和继续探索：
  `src/components/albums/album-detail.tsx`，现有 DOM 顺序正确。
- 发现筛选与 URL 状态：`src/components/discover/discover-catalog.tsx`。
- 搜索与 URL 状态：`src/components/search/search-catalog.tsx`。
- 统一分页：`src/components/catalog-pagination.tsx`、
  `src/catalog/pagination.ts`；目录 48、搜索 40。
- 本机状态、迁移和损坏恢复：
  `src/features/personal-state/personal-state-provider.tsx`、
  `src/features/personal-state/schema.ts`。

## 数据和路由

- 首页、搜索、发现、推荐只消费轻量索引：
  `src/catalog/published-catalog.ts`、`src/data/generated/catalog-index.json`。
- 单专辑详情独立读取：
  `src/catalog/published-album-details.ts`、
  `src/data/generated/album-details/*.json`。
- 当前目录：319 张专辑、274 位艺人、13 张有 RYM 评分、11 张有相关流派、
  15 个核心流派、7 个聆听场景、6 份编辑导览。
- 页面入口实际位于 `src/app/**/page.tsx`；专题静态参数由
  `src/catalog/topics.ts` 生成，未建立第二套路由系统。

## 发布

- `pnpm release:prepare` 要求干净提交，依次运行目录校验、lint、
  typecheck、test、build、静态 HTTP、双 ZIP 和交付验证：
  `scripts/release-prepare.mjs`。
- 源码与静态包规则：
  `scripts/package-source.mjs`、`scripts/package-static.mjs`、
  `scripts/verify-delivery.mjs`。
- V1 静态首页基线：11 个 `_next` 请求，相关 JS 1,055,756 字节、
  CSS 32,199 字节、7 个首页图片元素；静态 ZIP 49,209,979 字节。

## 事实调查后的实现边界

V1.1 复用上述目录、查询、状态、分页、详情和发布能力。允许新增首页版位配置、
编辑展示层、有限 Anime.js 客户端边界和 Playwright 测试，但不复制目录数据，
不重写业务算法。

