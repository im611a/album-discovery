# V1.1 实施契约

## 状态

| 阶段 | 状态 |
|---|---|
| A：事实、契约、决策与 Skills | VERIFIED |
| B：代表页面和内部视觉门 | VERIFIED |
| C：全站扩展 | VERIFIED |
| D：浏览器、可访问性与性能回归 | VERIFIED |
| E：静态交付与最终审计 | VERIFIED |

只使用 `NOT_STARTED`、`IN_PROGRESS`、`VERIFIED`、`BLOCKED`。

## 不可修改

- 319 张正式目录、274 位艺人、网易云身份、RYM 值、同步和推荐算法。
- V1 标签 `v1.0.0-local` 与外部封存目录。
- 静态输出、轻量索引、独立详情、URL 状态、本机状态和发布原子替换。
- 不增加播放器、账号、评论、热度、地域推断或“氛围与特征”。

## 必须保留

- 发现页六类筛选、48 张分页和 RYM 降序。
- 搜索 40 条分页、专题深层路由、探索、推荐和本机导入导出。
- 详情顺序：主要信息 → 曲目 → 同艺人其他专辑 → 继续探索。
- 运行时音乐数据请求为 0，封面只用本地资源。

## 首页契约

顺序固定为：

1. Editorial Album Canvas
2. Featured Album Sequence
3. Artist Feature
4. Genre Index
5. Decade Timeline
6. Listening Scenes
7. Personal Discovery
8. Recent Collection
9. Footer Archive

桌面使用集中配置的 12 列编辑 Grid；手机独立流式构图。所有封面进入对应详情，
任何配置缺失使用确定性目录 fallback。

## 视觉与排版

- 蓝黑近黑背景、宋体系统栈、封面原色、少阴影、少圆角、分隔线和负空间。
- 正文原则上至少 16px；表单控件继承宋体；数字 tabular。
- 360、390、768、1024、1280、1440、1920 均无溢出或遮挡。

## 动画

- 运行时唯一动画引擎 Anime.js 4.5.0。
- `createScope` + `scope.revert()`；opacity/transform 为主。
- 支持 reduced-motion 与 `?visualTest=1`，无永久循环和持续 RAF。

## 第三方边界

- 必须使用 Anime.js 与 Playwright。
- React Bits、Aceternity UI、Uiverse 当前采用数量均为 0；只有重新审计并明显优于
  原创实现才可改变。
- 禁止 Motion、Framer Motion、GSAP、Three、WebGL、远程字体和远程图片。

## 测试与验收

- Vitest 覆盖配置 fallback、真实链接、DOM 顺序、菜单 Esc、动画清理和业务回归。
- Playwright 覆盖固定视口、图片解码、console/network、键盘、深层刷新、
  reduced-motion、横向溢出和 Chromium 视觉基准。
- 最终执行目录校验、lint、typecheck、完整测试、build、Playwright 和
  `git diff --check`；Blocker 0、Major 0。

## 停止条件

- 基线或 V1 封存变化；需要修改正式目录、同步、推荐或数据库；第三方许可不清；
  必须引入第二动画引擎；代表页面无法通过内部视觉门；发布产生未解释 tracked diff。
