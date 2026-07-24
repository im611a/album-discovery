# 数据来源与刷新

## 字段所有权

| 字段 | 权威来源 |
|---|---|
| 目录身份、标题、别名、艺人 | 网易云构建期同步 |
| 日期、类型、公司、曲目 | 网易云专辑详情 |
| 封面与外部专辑入口 | 网易云公开元数据，构建期本地化 |
| 核心流派 | 人工确认；可靠 RYM Primary Genres 仅在唯一匹配后核对发布 |
| 相关流派 | 仅可靠离线 RYM Secondary Genres |
| RYM 社区评分与人数 | 仅同一可靠离线 RYM 快照 |
| 聆听场景和中文导览 | 本地策展层 |
| 市场频道 | 网易云新发行请求侧发现上下文 |

网易云是唯一正式专辑目录来源。RYM 是可选离线增强，不决定目录资格。项目不使用 MusicBrainz、Cover Art Archive、Last.fm 或 ListenBrainz。

## 网易云同步

`pnpm catalog:sync` 接受 JSON 或 CSV 的专辑 ID、艺人 ID或审核候选。命令支持 `--dry-run`、`--resume`、`--limit`、`--seed`、`--offline` 和 `--verify-cache`。

同步仅在维护阶段访问 `music.163.com` 的公开专辑与艺人元数据路径；封面只接受 HTTPS 的 `music.126.net` 静态资源。任务不使用登录、Cookie、Token、Authorization、浏览器数据、代理、播放地址或访问限制绕过。401、403、429、验证码与风控信号立即停止对应请求。

请求至少间隔两秒，单项最多重试一次；原始响应、检查点、摘要与失败日志位于 `.cache/catalog/sync/`。候选目录完整验证后才原子替换稳定快照。

缓存记录包含获取时间和内容 SHA-256，哈希不匹配时拒绝使用。`--offline` 在缓存缺失时返回结构化失败且绝不联网；`--verify-cache` 只校验缓存并报告数量，不写目录。平台验证统一标记 `PLATFORM_VERIFICATION_REQUIRED`，不按专辑解析，也不循环重试。

2026-07-24 的匿名小规模冒烟结果为 `PARTIAL`：3 个艺人元数据请求通过；10 个专辑请求虽然返回 HTTP 200，但响应为平台验证形态，不能按公开专辑结构解析。任务未使用登录、Cookie、Token 或 Authorization，也未修改稳定目录；异常响应未保留在缓存。该结果不能证明当前专辑详情路径适合稳定在线同步，详见 `reports/catalog/netease-online-smoke.json`。

专题发布阶段按新上限再次执行且仅执行一次冒烟：5 个专辑网络请求中 3 个明确识别为 `PLATFORM_VERIFICATION_REQUIRED`，2 个为非预期公开形态；3 个艺人检查命中既有可靠缓存并通过。稳定目录哈希保持不变。该 `PARTIAL` 结果继续支持“只把在线同步视为受平台状态影响的维护能力”，不支持扩大采集或绕过验证。

## 离线 RYM 增强

`catalog:rym:inspect` 与 `catalog:rym:enrich` 只读取本地文件。当前采用公开下载的 Kaggle “Rate Your Music Top 5000”研究数据，许可未说明，因此明确标记为 `PERSONAL_RESEARCH_INPUT`；原始文件不提交、不分发。任务报告记录来源、观察时间与输入 SHA-256。

匹配必须同时综合标题或登记别名、完整艺人集合、发行年份和发行类型，并且候选可靠唯一。只有 `MATCHED_EXACT`、`MATCHED_ALIAS`、`MATCHED_STRONG` 可以发布评分或分类；其他状态保持空值。评分必须大于 0 且不超过 5，人数若存在必须是非负整数，非匹配记录不得携带评分。

本次 5000 行输入覆盖 13 张可靠精确匹配专辑；13 张具有评分和评分人数，11 张具有 Secondary Genres，核心流派自动调整为 0。其余 306 张不发布 RYM 字段。Primary Genres 仅用于审计；Descriptors 在输入边界解析后丢弃，不进入前端。任何构建和浏览器路径都不会访问 RYM。

原始输入 SHA-256：`272cc798cb1d1058048500485d1668855d9a251bb19fef9e52beaae81a8ec6b7`。详细证据见 [RYM_ENRICHMENT_AUDIT.md](./RYM_ENRICHMENT_AUDIT.md)。

## 场景与地区边界

本站聆听场景使用稳定 key：`commute`、`night`、`solitude`、`focus`、`relax`、`exercise`、`social`；界面显示自然中文。它是本站策展维度，不冒充平台或 RYM 分类。

`ALL`、`ZH`、`EA`、`JP`、`KR` 只表示请求侧市场频道，不能转换为国家、地区、语言、国籍或法域。缺失字段保持缺失，不从名称和文字推断。
