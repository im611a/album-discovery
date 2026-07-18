# 数据来源与刷新

## 来源职责

MusicBrainz release-group 是专辑概念身份的主来源；代表版 release 只在需要曲目时确定使用。发布快照保留 release-group MBID 和代表版 release MBID，避免把不同版本曲序混成“唯一曲目表”。

Cover Art Archive 是封面首选来源。刷新脚本按 release-group 请求 250px 正面缩略图并存入 `public/catalog/covers/`；源站不可达或无图时发布明确的生成式回退，不热链图片，也不主张封面版权。

中文摘要、为什么听、描述词、聆听场景与起始曲选择属于本站原创编辑层。机器辅助或元数据推导内容保持 `metadata_based` 和 `humanReviewed: false`；只有经过真实人工复核才可改成 `curated`。

外部链接只在存在精确专辑 URL 时发布。链接来自 MusicBrainz URL relation、Apple iTunes Search API 的精确 artist/title 匹配，或人工核验的直接专辑 URL。没有直达链接时仅给出可复制搜索词，不伪装为直达。

## 官方访问规则（核验于 2026-07-18）

- MusicBrainz 要求包含应用名、版本和联系方式的 User-Agent；来源 IP 平均每秒最多 1 次请求。脚本使用至少 1.1 秒间隔。
- MusicBrainz 搜索 `limit` 范围为 1–100；本项目每个明确候选只请求少量匹配项，并拒绝身份歧义。
- Cover Art Archive 支持 release 与 release-group JSON、front 及 250/500/1200 缩略图；当前官方文档未列独立限流，本项目仍采用串行、超时与熔断。
- Apple iTunes Search API 官方文档建议约 20 次/分钟并缓存；项目只在旗舰缺少 URL relation 时使用，按 storefront 精确匹配专辑名和艺术家。

官方文档：

- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- https://musicbrainz.org/doc/MusicBrainz_API/Search
- https://musicbrainz.org/doc/Cover_Art_Archive/API
- https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/

## 刷新流程

`scripts/catalog/curation-manifest.mjs` 明确列出 120 个 artist/title 候选、主流派与纳入原因，不进行随机抓取。`pnpm catalog:refresh` 依次完成身份解析、旗舰详情与代表版曲目、封面、外部链接、规范化和发布前硬门。原始响应只写入忽略的 `.cache/catalog/`。

发布前要求至少 120 张、24 张旗舰、12 个主流派，以及 24/24 旗舰外链覆盖。失败报告写入 `reports/catalog/refresh-report.json`，已有有效快照保持不变。

## 归属与非依赖

MusicBrainz 核心数据以 CC0 提供，部分用户贡献数据可能受 CC BY-SA 约束；应用页脚和设置页保留归属。Cover Art Archive 图像权利仍属于各自权利人，使用风险需由部署者评估。

NetEase 实验保存在 `experiments/netease-catalog-spike/`，不参与运行。RYM 不被抓取或依赖；旧离线导入契约仅作为历史边界，不进入发布快照。
