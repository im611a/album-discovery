# V1.1 视觉重设计审计

状态：IN_PROGRESS

本文件只在真实检查后记录结果；最终提交和发布完成前不标记 VERIFIED。

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

## 待最终记录

- 第二遍完整质量门；
- 最终 JS/CSS/ZIP 体积；
- release manifest、双 ZIP SHA-256；
- 最终 Git、stash、tag 和 V1 封存状态。
