# V1.1 视觉重设计审计

状态：VERIFIED

## 已验证

- 正式目录保持 319 张专辑、274 位艺人、15 个核心流派、24 个相关流派、
  7 个聆听场景、13 张带 RYM 评分、11 张带相关流派；
- 首页 9 个配置对象与 fallback 均为确定性，正式数据未改写；
- 首页、发现、搜索、详情、艺人、专题、个人、设置、关于和 404 通过 Chromium
  静态路由冒烟；
- Chromium 4 个产品 E2E 与 11 个视觉基准通过；WebKit 产品冒烟通过；
- Firefox 151 浏览器已下载，但当前 Windows 环境启动时报
  `RenderCompositorSWGL failed mapping default framebuffer`，属于浏览器运行环境限制，
  不是本站 console 或页面错误；
- Vitest 当前 48 个文件、849 个用例通过；
- 没有 React Bits、Aceternity UI 或 Uiverse 运行时代码。
- 首页静态 HTML 关联 11 个 JS 资源（1,092,502 字节）和 1 个 CSS 资源
  （46,083 字节），含 33 个图片元素；V1 基线分别是 1,055,756 字节、
  32,199 字节和 7 个图片元素。增长来自 Anime.js 客户端边界、编辑首页结构与
  响应式规则，没有 WebGL、视频、远程字体或持续动画。
- `test.skip` 的唯一命中是视觉基准明确只由 Chromium 持有；产品 E2E 没有
  skip、todo 或 only。目录中的 “coming soon” 命中是正式曲目标题，不是占位功能。

## 最终质量与交付

- `pnpm quality` 第二遍通过：目录校验、lint、typecheck、48 个 Vitest 文件、
  849 个用例和静态 build 全部成功；
- Chromium 产品 E2E 4/4、视觉基准 11/11；WebKit 产品 E2E 4/4；
- `release:prepare` 在干净功能提交 `c4dac59` 上通过静态 HTTP、源码包、静态包、
  解压和清单校验；
- manifest：319 张专辑、274 位艺人、13 张评分、11 张相关流派、661 个目录式
  静态页面，`visualDesignVersion: "1.1"`、`designSystem: "editorial-songti"`、
  `animationEngine: "animejs"`；
- 该次源码包 37,695,433 字节，静态包 49,602,972 字节；V1 静态包基线
  49,209,979 字节，增加 392,993 字节（约 0.8%）；
- V1 标签仍指向 `fbb9891`，main、stash 和
  `D:\Projects\album-discovery-releases\v1.0.0-local` 未修改。

## 审计结论

Blocker 0，Major 0。Firefox headless 启动限制记为 Minor 环境限制；未执行的
Firefox 产品冒烟必须在可用图形环境中补跑，不影响已验证的静态产品和交付包。
