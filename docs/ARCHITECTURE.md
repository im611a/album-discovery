# 现行架构

## 数据流

```text
中文优先候选 + 固定网易云 albumId
→ 串行、限频、可缓存的构建期刷新
→ 网易云公开专辑详情 / 本地封面
→ 规范化、离线 RYM 唯一匹配或人工核心流派与硬校验
→ src/data/generated/catalog-index.json（列表）+ catalog.json（详情）
→ src/catalog 查询与确定性推荐
→ App Router 静态页面
→ 浏览器本机个人状态
```

浏览器只读取随站点发布的本地快照。Provider 请求、原始缓存和请求日志不进入页面依赖。构建时为全部专辑生成静态详情路由，并通过 `output: "export"` 写入 `out/`。

## 主要边界

- `scripts/catalog/**`：固定网易云身份、匿名构建期访问、规范化、封面下载、校验和报告。
- `public/catalog/covers/**`：按 neteaseAlbumId 命名的本地封面。
- `src/data/generated/**`：确定性的发布快照与统计。
- `src/catalog/**`：发布模型、统一分类显示、搜索、发现查询、相关专辑和推荐评分。
- `src/features/personal-state/**`：版本化本机状态、校验、目录 ID 对账、损坏恢复与 React 上下文。
- `src/app/**`：静态页面结构和元数据。
- `src/components/**`：客户端交互，只消费发布模型，不了解上游响应。

## 发布模型

`PublishedAlbum` 同时保存内部稳定 ID 与 `neteaseAlbumId`。网易云负责专辑身份和目录字段。可靠匹配时，`coreGenres`、`relatedGenres`、`descriptors` 分别映射离线 RYM Primary Genres、Secondary Genres、Descriptors；未匹配时只允许人工确认的 `coreGenres`，其余两类必须为空。`contexts` 与 `editorial` 属于本地策展层。`sourceMarketChannels` 是发现记录，不是专辑固有地区字段。

RYM 匹配是构建期纯函数，必须同时核对标题与别名、艺人、发行年份和发行类型，并要求唯一候选。输入仅来自 checked-in 离线快照；浏览器、构建和刷新均不访问 RYM 网站。发现页选项由实际发布值构造，因此空分类不生成筛选项，旧 URL 中的无效参数会安全忽略。

## 推荐

推荐引擎是纯 TypeScript 确定性函数。权重集中在 `RECOMMENDATION_WEIGHTS`，输入包括核心流派、延伸流派、氛围特征、场景、年代、种子、想听、喜欢、近期浏览与显式反馈。想听作为弱正向种子且自身被排除，喜欢作为强正向种子且自身被排除，听过被排除，不适合同时形成排除与负向相似度信号。理由只来自真实得分贡献。

## 本机状态

`LocalUserStateV1` 使用固定 storage key。加载时验证结构、迁移可识别的旧状态、拒绝未来版本、过滤已离开目录的 ID，并统一喜欢与不适合冲突。损坏或存储不可用不会让页面崩溃。没有远程同步、账号或分析 SDK。

## 静态交付

`pnpm build` 完成 Next.js 静态导出。`pnpm package:source` 创建干净源码包；`pnpm package:static` 将 `out/` 根内容创建为可部署静态包；`pnpm delivery:verify` 解包并检查首页、全部详情页、静态资源和禁止项。静态站点不需要 Next.js 开发服务器，深层路由使用目录式 `index.html`。
