# 专辑发现

面向中文用户的完整专辑发现与聆听指南。选择类型与场景后，应用会在本机生成有具体理由的推荐；用户可以保存、喜欢、标记听过或排除专辑，再通过经核验的外部链接离开本站聆听。

产品不需要账号，不上传个人口味，正常浏览不实时请求音乐数据源。

## 已交付能力

- 120 张真实 MusicBrainz release-group 专辑，12 个本站主流派组；
- 24 张带中文摘要、聆听方式、场景与起始曲提示的旗舰专辑；
- 口味设置、确定性推荐、推荐理由与即时反馈；
- 想听、喜欢、听过、不适合我的本机专辑库；
- 本机状态的校验、导出、导入与重置；
- 发现筛选、全文本地搜索、最近收录与有日期依据的近期发行视图；
- 120 个静态专辑详情页、静态 sitemap、robots 与完整静态导出；
- MusicBrainz、Cover Art Archive 和外部平台链接的离线刷新工具。

当前快照未包含虚构 RYM 评分。Cover Art Archive 在生成环境中不可达，因此当前 120 张专辑都使用明确的生成式回退封面。

## 本地运行

需要 Node.js 24、pnpm 11.7.0。

```text
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:3000`。已安装依赖后，日常开发和浏览均可离线进行。

## 目录工具

```text
pnpm catalog:validate
pnpm catalog:audit-identities
pnpm catalog:report
pnpm catalog:refresh
pnpm catalog:check-links
```

`catalog:refresh` 只使用经过人工复核并固定在 `scripts/catalog/verified-identities.json` 的 120 个 MusicBrainz release-group ID。标题搜索只用于人工发现候选，不能决定发布身份。刷新会访问 MusicBrainz 与 Cover Art Archive，使用可联系的 User-Agent、MusicBrainz 每请求至少 1.1 秒间隔、本地忽略缓存、超时与有限重试；失败不会覆盖上一份有效快照。

## 质量与交付

```text
pnpm quality
pnpm package:source
pnpm package:static
pnpm delivery:verify
```

`pnpm build` 使用 Next.js 静态导出，产物位于 `out/`。部署时可设置 `NEXT_PUBLIC_SITE_URL` 生成正式 sitemap 与 canonical 基址；未设置时使用 `http://localhost:3000`。

构建后可运行 `pnpm serve:static`，在 `http://127.0.0.1:4173` 用普通静态 HTTP 服务验收 `out/`，不依赖 Next.js 开发服务器。

交付文件写入 `artifacts/`：`album-discovery-source.zip` 是源码包，`album-discovery-static-site.zip` 是可直接部署的 `out/` 内容。两者都会由 `delivery:verify` 检查结构与禁止项；源码包不会包含 `.git`、`node_modules`、`.next`、`out`、缓存或本地秘密。

## 数据边界

- MusicBrainz：专辑身份、艺术家、发行日期、代表版与曲目；
- Cover Art Archive：封面首选来源；不可用时使用本站生成式回退；
- 本站原创层：中文导览、类型、描述与聆听场景；当前均标记 `metadata_based`，不冒充人工评论；
- 外部平台：仅展示静态快照中已核验的直达链接；
- NetEase：只保留历史实验，不是产品运行依赖；
- RYM：不抓取、不依赖、不展示虚构评分。

详见 [产品说明](./docs/PRODUCT.md)、[数据来源](./docs/DATA_SOURCES.md) 与 [现行架构](./docs/ARCHITECTURE.md)。
