# V1.1 蓝黑编辑档案设计系统

## 原则

专辑封面是主要视觉，文字负责建立编辑层级。界面使用安静的深海军蓝背景、
低对比冷蓝灰边框和克制冷蓝强调，以音乐杂志和专辑档案馆为方向，不模仿播放器、
后台或电商。

## Token

全局变量位于 `src/app/globals.css`：

- 背景：`--page-background`、`--elevated-background`、`--card-background`、`--card-hover`、`--input-background`；
- 结构：`--border`、`--border-strong`；
- 文字：`--text-primary`、`--text-secondary`、`--text-muted`；
- 状态：`--accent`、`--accent-hover`、`--focus-ring`、`--warning`、`--destructive`、`--success`。

深色是唯一正式主题。不使用纯黑铺满页面或纯白大背景。

## 排版与间距

全站使用 `"Songti SC", "STSong", "SimSun", "NSimSun",
"Noto Serif CJK SC", serif`，不下载网络字体。表单控件继承字体，正文基准
16px，数字使用 tabular nums。统一内容宽度为 1240px；层级主要依靠字号、位置、
字距、分隔线和负空间，不依赖合成粗体。

## 编辑首页

- `src/config/editorial-home.ts` 集中保存 12 列桌面版位、尺寸和可见性；
- 桌面有 large、medium、small 三级封面，位置不使用随机数；
- 平板减少对象并重新分配行高；360–390px 使用独立双列流，首屏至少露出两张封面；
- 后续依次是精选专辑、艺人档案、流派索引、年代、场景、本机发现和最近收录；
- 工具页继续使用规则网格、表单与分页，不被强行改造成自由画布。

## 组件

- AlbumCard：1:1 封面、两行标题、独立艺人链接、低权重元数据与可选 RYM 分数；
- 探索卡片：复用 AlbumCard，并在卡片外提供一条来自实际得分贡献的简短原因，不显示相似度百分比；
- ArtistCard：本地封面预览、名称、收录数量和少量常见核心流派；
- 按钮：primary、secondary、quiet、danger 四种语义；
- 表单：深色输入背景、明确标签、可见 focus 和诚实 disabled 说明；
- Header：桌面紧凑导航，移动端菜单支持键盘、Esc 和路由关闭；
- 空状态：简短原因与单一下一步，不使用大型插画。

## 响应式

- 360–390px：专辑通常两列，筛选默认折叠，菜单紧凑；
- 768px：三至四列；
- 1024–1440px：五至六列；
- 详情在小屏自然堆叠，曲目名可换行，时长保持右对齐。
- 探索路径控制区在手机端单列，结果沿用两至六列专辑网格；详情后的继续探索不挤压首屏。
- 专题索引在手机端使用紧凑单列入口、平板两列、桌面三列；专题详情沿用现有 AlbumCard 与筛选控件。
- 分页在手机端保持上一页、进度和下一页三个清晰触控目标，不使用无限滚动。

## 动效与可访问性

CSS 过渡限于 hover、focus、按钮、菜单和筛选展开。首页进入和区块 reveal 由
Anime.js 4.5.0 的 `createScope`、`animate`、`stagger` 实现，卸载时
`scope.revert()`；IntersectionObserver 只触发一次，不存在循环或持续 RAF。
`prefers-reduced-motion` 和 `?visualTest=1` 会跳过运行时动画且内容保持可见。
页面保留 skip link、唯一 h1、语义化表单、清晰 focus、可读 disabled 说明和明确外链文案。

## 禁止模式

不使用霓虹赛博、重度玻璃拟态、大面积发光、自动轮播、3D 卡片、跟随鼠标、连续背景动画、播放器仿制或大量飞入动画。
