# V1.1 设计决策

## LOCKED

- 蓝黑色调和系统宋体体系。
- 非对称真实专辑封面首页，封面进入真实详情。
- 精选专辑、真实艺人、流派、年代、场景、个人发现和最近收录章节。
- Anime.js 为唯一运行时动画引擎，Playwright 用于浏览器与视觉回归。
- V1 功能、静态架构、标签和封存保持不变。
- 无播放器，不恢复“氛围与特征”。

## DERIVED

- 首页使用 12 列 CSS Grid，版位集中在 `src/config/editorial-home.ts`。
- 标准工具页保留线性内容流，只共享宋体、蓝黑 Token、线条、标题和交互状态。
- 首页配置仅保存 slug 和版位，不复制专辑数据；缺失 slug 使用稳定候选。
- 动效边界放在小型客户端组件中，服务端页面仍直接输出完整可见内容。
- 三种展示共享 `PublishedAlbumSummary`、`AlbumCover`、艺人链接和操作逻辑。

## OPTIONAL

- 低幅度滚动进入、轻微封面 tilt、标题 reveal；不影响内容理解时才启用。
- 纯 CSS 的圆形封面裁切可用于精选章节，但没有播放图标或旋转。

## REJECTED

- React Bits：当前官方许可为 MIT + Commons Clause，且多数价值集中于额外动画；
  本次原创 CSS + Anime.js 足够，采用 0。
- Aceternity UI：免费组件常依赖 Motion/Framer Motion，和唯一动画引擎冲突；
  Pro 模板与 Blocks 明确禁用，采用 0。
- Uiverse：没有需要外部小控件才能解决的问题，采用 0。
- 霓虹、玻璃拟态、粒子、3D、无限轮播、远程字体/图片和普通等大首页网格。

