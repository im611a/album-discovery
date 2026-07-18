# 数据来源与刷新

## 来源职责

MusicBrainz release-group 是专辑概念身份的主来源；代表版 release 只在需要曲目时确定使用。发布快照保留 release-group MBID 和代表版 release MBID，避免把不同版本曲序混成“唯一曲目表”。120 个发布身份逐条固定在 `scripts/catalog/verified-identities.json`，包含预期标题、主艺术家、首发年份、主类型、复核时间和说明；自动搜索结果不能覆盖这份清单。

Cover Art Archive 是封面首选来源。刷新脚本按 release-group 请求 250px 正面缩略图并存入 `public/catalog/covers/`；源站不可达或无图时发布明确的生成式回退，不热链图片，也不主张封面版权。

中文摘要、为什么听、描述词、聆听场景与起始曲选择属于本站原创编辑层。机器辅助或元数据推导内容保持 `metadata_based` 和 `humanReviewed: false`；只有经过真实人工复核才可改成 `curated`。

外部链接只在存在精确专辑 URL 时发布。链接来自 MusicBrainz URL relation或固定身份清单中保留并人工核对的直接专辑 URL。刷新过程不调用其他音乐平台搜索接口；没有直达链接时仅给出可复制搜索词，不伪装为直达。

## 官方访问规则（核验于 2026-07-18）

- MusicBrainz 要求包含应用名、版本和联系方式的 User-Agent；来源 IP 平均每秒最多 1 次请求。脚本使用至少 1.1 秒间隔。
- MusicBrainz 搜索 `limit` 范围为 1–100；本项目每个明确候选只请求少量匹配项，并拒绝身份歧义。
- Cover Art Archive 支持 release 与 release-group JSON、front 及 250/500/1200 缩略图；当前官方文档未列独立限流，本项目仍采用串行、超时与熔断。

官方文档：

- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- https://musicbrainz.org/doc/MusicBrainz_API/Search
- https://musicbrainz.org/doc/Cover_Art_Archive/API

## 刷新流程

`scripts/catalog/curation-manifest.mjs` 明确列出 120 个 artist/title 候选、主流派与纳入原因，不进行随机抓取。`scripts/catalog/verified-identities.json` 是发布身份权威；`pnpm catalog:audit-identities` 只按固定 ID 重新核对官方记录，不搜索或改写清单。`pnpm catalog:refresh` 依次完成固定身份核对、旗舰详情与代表版曲目、封面、外部链接、规范化和发布前硬门。原始响应只写入忽略的 `.cache/catalog/`。

发布前要求恰好覆盖 120 份固定身份、至少 24 张旗舰、12 个主流派，以及 24/24 旗舰外链覆盖。校验器同时比对固定 MBID、标题、主艺术家、首发年份、发行类型、日历有效的 PartialDate 和重点指南的合理曲目下限。失败报告写入 `reports/catalog/refresh-report.json`，已有有效快照保持不变。

## 归属与非依赖

MusicBrainz 核心数据以 CC0 提供，部分用户贡献数据可能受 CC BY-SA 约束；应用页脚和设置页保留归属。Cover Art Archive 图像权利仍属于各自权利人，使用风险需由部署者评估。

NetEase 实验保存在 `experiments/netease-catalog-spike/`，不参与运行。RYM 不被抓取或依赖；旧离线导入契约仅作为历史边界，不进入发布快照。
