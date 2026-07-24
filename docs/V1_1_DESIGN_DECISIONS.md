# V1.1 全站重建设计决策

## LOCKED

- 蓝黑色调、系统宋体、真实本地专辑封面和清晰主导航。
- 首页静默开场、滚动揭示、桌面指针深度、三章重点专辑与活动黑胶。
- 发现、搜索、艺人、专辑、探索、推荐、最近收录、我的专辑、专题、设置、关于和 404
  共享同一编辑系统，但使用不同动态等级。
- Next.js 静态导出、根 Server Layout、现有本机状态、RYM 与相关流派、分页、Sitemap
  和发布自动化保持兼容。
- 无播放器、无自动音频、无“氛围与特征”、无地区推断。

## DERIVED

- 首页版位和运动参数集中于 `src/config/editorial-home.ts`，正式数据仍由目录查询解析。
- `EditorialMotion` 以单 RAF 同步滚动与指针；点击内部链接前保存首页位置，返回后恢复。
- `RouteMotion` 是唯一新增的全站轻动效客户端岛；根布局没有 Client 化。
- 搜索结果复用 `CompactAlbumRow`，并新增只负责搜索艺人结果的 `ArtistEditorialRow`。
- 艺人索引每人一张缩略图；艺人详情从真实作品取最多五张封面组成组合。
- 首页所有不允许重叠的封面在 1280、1440、1920 与五个指针位置下做几何检测。

## OPTIONAL / PARTIAL

- 参考站观察仅作为运动节奏证据，不复制资源；指针检查没有观察到参考站图片 transform。
- WebKit 是 Safari 的近似验证。
- 当前自动化环境无法可靠操作浏览器 UI 的真实 200% 缩放，因此该项保持 `PARTIAL`，
  不能用窄视口冒充。
- Firefox 若仍出现本机 SWGL 映射错误，按环境限制记录 `PARTIAL`。

## REJECTED

- React Bits、Aceternity UI、Uiverse：没有采用；现有 React、CSS 与 Anime.js 足够。
- Motion、Framer Motion、GSAP、Three.js、WebGL、粒子、Lenis、Swiper 和远程视觉资源。
- 滚轮劫持、永久 RAF、自动轮播、虚假唱片控制、复制参考站品牌或源码。

## 人工验收边界

当前工程只能进入 `READY_FOR_HUMAN_REVIEW`。发布清单固定写
`humanVisualAcceptance: "pending"`；只有用户实际查看最终唯一预览目录后才能改变该事实。
