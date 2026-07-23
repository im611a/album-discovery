# 专辑发现

面向中文用户的静态专辑发现网站。它把真实网易云专辑目录、本站策展分类、可解释推荐、艺人路径和只保存在浏览器中的个人专辑状态连成一条无需账号的使用路径。

## 当前能力

- 319 张以网易云 albumId 固定身份的真实专辑和 274 位艺人；
- 核心流派、可选的可靠 RYM 相关流派，以及独立的本站聆听场景；
- 首页、发现、为你推荐、最近收录、搜索、艺人、我的专辑、设置和静态详情；
- 确定性本机推荐，以及想听、喜欢、收藏、听过、不适合我的本地状态；
- 轻量列表索引、逐专辑详情文件、独立艺人索引和本地 WebP 封面；
- 完整 Next.js 静态导出，不要求运行 Next.js 服务器。

浏览器不会实时访问网易云、RYM 或其他音乐数据源。专辑详情的唯一外部音乐操作是前往对应网易云专辑页。

## 本地开发与质量检查

```text
pnpm install --frozen-lockfile
pnpm dev

pnpm catalog:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 可恢复目录同步

本地 JSON/CSV 种子可以登记已审核的网易云专辑 ID 或艺人 ID：

```text
pnpm catalog:sync -- --dry-run --limit 10
pnpm catalog:sync -- --resume
pnpm catalog:sync -- --seed ./path/to/seeds.csv --limit 50
```

同步任务固定批次处理，使用至少两秒请求间隔、有限重试、原始响应缓存、失败日志和检查点。候选目录只有在完整验证通过后才原子发布；重复 ID 被去重，已有可靠 RYM 字段不会被网易云同步清除。缓存和检查点位于被忽略的 `.cache/catalog/`。

旧的 `catalog:refresh` 仍用于固定全量种子维护；新增和增量维护优先使用 `catalog:sync`。

## 可选 RYM 离线增强

```text
pnpm catalog:enrich:rym -- --input ./path/to/authorized-offline-dataset.json --dry-run
pnpm catalog:enrich:rym -- --input ./path/to/authorized-offline-dataset.json
```

只有标题或别名、完整艺人、年份和发行类型形成唯一复合匹配时，才发布 RYM 社区评分、评分人数、Primary Genres 和 Secondary Genres。没有合法离线文件时不运行该命令，评分保持 `null`，相关流派保持空数组；目录、构建和推荐仍正常工作。该流程不访问 RYM 网站。

## 封面与发布

```text
pnpm catalog:optimize-covers
pnpm catalog:publish
pnpm package:source
pnpm package:static
pnpm delivery:verify
pnpm serve:static
```

- `album-discovery-source.zip`：源码、测试、文档、发布快照和必要 WebP 资源；
- `album-discovery-static-site.zip`：可直接部署的静态成品，根目录含 `release-manifest.json`。

两个压缩包均排除 Git、依赖、构建缓存、环境文件、凭据和原始响应。完整边界见 [产品说明](./docs/PRODUCT.md)、[架构](./docs/ARCHITECTURE.md)、[数据来源](./docs/DATA_SOURCES.md)和[设计系统](./docs/DESIGN_SYSTEM.md)。
