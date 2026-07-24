# V1.1 第三方技术与采用记录

## 实际采用

| 项目 | 版本 | 许可证 | 官方来源 | 用途 |
|---|---:|---|---|---|
| Anime.js | 4.5.0 | MIT | `animejs.com` / `github.com/juliangarnier/anime` | 有限客户端进入动效 |
| Playwright Test | 1.61.1 | Apache-2.0 | `playwright.dev` / `github.com/microsoft/playwright` | E2E 与视觉回归 |

Anime.js 使用官方 V4 ESM `animate`、`stagger`、`createScope`，React 清理由
`scope.revert()` 完成。Playwright 使用官方 `defineConfig`、
`toHaveScreenshot` 和 Chromium/Firefox/WebKit project 契约；仓库的
`scripts/run-playwright.mjs` 负责在测试期间启动和关闭静态 HTTP 服务。

## 审计但未采用

- React Bits：官方仓库标示 MIT + Commons Clause；未复制代码，采用数量 0。
- Aceternity UI：免费与付费边界并存，常见动画组件依赖 Motion；
  不采用 Pro 内容或代码，采用数量 0。
- Uiverse：本阶段没有明显优于现有语义按钮与表单的组件，采用数量 0。

没有复制 Meinhard Taxer 页面或上述组件库的源码、CSS、图片、字体或品牌素材。
