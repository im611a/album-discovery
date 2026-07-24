# V1.1 全站编辑动效设计系统

状态：`READY_FOR_HUMAN_REVIEW`。这表示工程证据已齐备，仍不等于用户人工验收通过。

## 方向与 Token

专辑发现是一册蓝黑色的中文音乐档案：真实封面承担情绪，系统宋体承担编辑层级，
线条、留白与尺度差建立空间。唯一主题为深色；不使用远程字体、远程图片、霓虹、
玻璃拟态或播放器外观。

全局 Token 位于 `src/app/globals.css`。背景、表面、线条、主次文字、强调色、状态色、
安全边距、内容宽度和章节间距都通过 CSS 变量管理。正文使用
`"Songti SC", "STSong", "SimSun", "NSimSun", serif`，数字使用等宽数字特性。

## 页面原型

| 原型 | 页面 | 视觉与动效 |
|---|---|---|
| immersive-gallery | 首页 | A 级：静默开场、原生滚动揭示、单 RAF 指针深度、三章 Deck、活动黑胶 |
| editorial-tool | 发现、搜索、探索、推荐、最近收录、我的专辑 | C 级：规则表单、行列档案、有限首屏进入 |
| artist-archive | 艺人索引 | C 级：每位艺人默认仅一张缩略封面 |
| artist-profile | 艺人详情 | B 级：2–5 张真实代表封面组合与作品目录 |
| album-essay | 专辑详情 | B 级：封面、身份、曲目、分类与编辑说明按证据层级排列 |
| topic-hub | 流派、场景、年代 | 索引 C 级、详情 B 级 |
| utility-minimal | 设置、关于、404 | D 级：静态优先，只有必要反馈 |

根布局仍是 Server Component。`RouteMotion` 和 `EditorialMotion` 是局部客户端岛；
搜索、筛选、移动菜单与本地状态继续使用原有客户端边界，没有把完整目录详情传入浏览器。

## 首页运动契约

- 普通桌面模式初始封面数为 0；滚动揭示可逆。
- 九个版位由 `src/config/editorial-home.ts` 管理：色组、尺度、深度、初始角度、
  进入方向、最大宽度和是否允许重叠均显式配置。
- 指针只在桌面精细指针环境工作，使用一个按需 `requestAnimationFrame`；稳定后停止。
- Deck 的编号、标题、封面和黑胶共享 `activeIndex`；非活动黑胶不旋转。
- `document.hidden`、`prefers-reduced-motion`、无 JavaScript 和 `?visualTest=1`
  都有明确静态降级。
- 不劫持滚轮，不建立自定义滚动容器，不持续修改布局属性。

## 共享组件

- `AlbumCover` 是所有封面唯一渲染入口。
- `AlbumCard` / `AlbumGrid` 服务发现与专题网格。
- `CompactAlbumRow` 服务搜索专辑结果等高信息密度场景。
- `ArtistCard` 服务艺人档案，每位艺人默认最多一张代表封面。
- `ArtistEditorialRow` 服务搜索艺人结果。
- `SiteHeader`、`SiteFooter`、分页、筛选、本机状态操作和分类标签继续全站复用。

## 响应式与可访问性

- 360–390：自然单列/双列流，不复用桌面绝对坐标。
- 768–1024：收敛封面数量与列宽，保持工具操作效率。
- 1280–1920：首页使用受配置约束的沉浸舞台；工具页保持规则阅读。
- 每页一个 `h1`，保留 skip link、landmark、可见 focus、语义表单与明确外链。
- 未进入可视阶段的首页封面退出 Tab 顺序；持有焦点时不会被突然隐藏。
- `prefers-reduced-motion` 下关闭滚动同步、视差与黑胶动画，内容按 DOM 顺序完整可达。

## 禁止模式

第二动画引擎、永久 RAF、WebGL、粒子、滚动劫持、无限轮播、自动播放、远程视觉资源、
把工具页改成自由画布，以及为视觉方便复制正式目录数据，均不属于本系统。
