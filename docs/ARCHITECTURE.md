# 现行架构

## 数据流

```text
明确候选清单 + 120 个固定复核身份
→ 带限流与缓存的导入脚本
→ MusicBrainz / Cover Art Archive / 可选链接解析
→ 规范化与验证
→ src/data/generated/catalog.json
→ src/catalog 查询与推荐
→ App Router 页面
→ 浏览器本机个人状态
```

正常页面只读取 checked-in 静态快照。Provider DTO、导入脚本和原始缓存不会进入页面依赖。构建时生成 120 个静态专辑详情路由，并通过 `output: "export"` 写入 `out/`。

## 主要边界

- `scripts/catalog/**`：固定身份清单、仅构建时的官方网络访问、缓存、解析、封面、验证和报告。
- `src/data/generated/**`：确定性的发布快照与清单统计。
- `src/catalog/**`：发布模型、显示标签、搜索、发现查询、相关专辑和推荐评分。
- `src/features/personal-state/**`：版本 1 本机状态、校验、目录 ID 对账、损坏恢复与 React 上下文。
- `src/app/**`：静态页面结构和元数据。
- `src/components/**`：必要的客户端交互，不了解上游 DTO。

## 推荐

推荐引擎是纯 TypeScript 确定性函数。权重集中在 `RECOMMENDATION_WEIGHTS`，输入包括用户选择的类型、描述、场景、年代、种子、想听、喜欢与显式反馈。想听作为弱正向种子且自身被排除，喜欢作为强正向种子且自身被排除，听过被排除，不适合同时形成排除与负向相似度信号。引擎限制同一艺术家与单一主流派集中度，并从真实得分贡献生成 1–3 条中文理由。

## 本机状态

`LocalUserStateV1` 使用独立版本号和固定 storage key。加载时验证结构，迁移可识别的无版本历史状态，拒绝未来版本，过滤已离开目录的 ID，并统一 like/favorite 与 not-for-me/dismissed 冲突。损坏时恢复为空状态；存储不可用不会让页面崩溃，并显示非破坏性说明。导入在读取前检查 100KB 上限，再复用相同校验器。没有远程同步、账号或分析 SDK。

## 静态交付

`pnpm build` 同时完成 Next.js 构建和静态导出。`pnpm package:source` 创建干净源码包，`pnpm package:static` 将 `out/` 根内容创建为可部署静态包，`pnpm delivery:verify` 解包并检查首页、120 个详情页、静态资源和禁止项。部署域名通过 `NEXT_PUBLIC_SITE_URL` 注入 sitemap 与 metadata 基址。
