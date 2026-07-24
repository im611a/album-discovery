# 蓝黑设计系统

## 原则

专辑封面是主要视觉，文字负责建立编辑层级。界面使用安静的深海军蓝背景、低对比冷蓝灰边框和克制冷蓝强调，不模仿播放器或后台系统。

## Token

全局变量位于 `src/app/globals.css`：

- 背景：`--page-background`、`--elevated-background`、`--card-background`、`--card-hover`、`--input-background`；
- 结构：`--border`、`--border-strong`；
- 文字：`--text-primary`、`--text-secondary`、`--text-muted`；
- 状态：`--accent`、`--accent-hover`、`--focus-ring`、`--warning`、`--destructive`、`--success`。

深色是唯一正式主题。不使用纯黑铺满页面或纯白大背景。

## 排版与间距

使用系统中文字体栈。Display、页面标题、区块标题、卡片标题、正文、次级正文、元数据、标签和说明逐级减弱；页面主标题在手机端不会占据半个首屏。统一内容宽度为 1180px，区块间距、网格间距和卡片内边距从同一节奏派生。

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

## 动效与可访问性

交互过渡为 150–220ms，限于 hover、focus、按钮、菜单和筛选展开。`prefers-reduced-motion` 会把动画和过渡降至近零。页面保留 skip link、唯一 h1、语义化表单、清晰 focus、可读 disabled 说明和明确外链文案。

## 禁止模式

不使用霓虹赛博、重度玻璃拟态、大面积发光、自动轮播、3D 卡片、跟随鼠标、连续背景动画、播放器仿制或大量飞入动画。
