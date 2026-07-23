# 数据来源与刷新

## 字段所有权

| 字段 | 权威来源 |
|---|---|
| 专辑是否进入目录、neteaseAlbumId、标题、别名、艺人 | 网易云构建期目录同步 |
| 发行日期、发行类型、公司、曲目数、曲目表 | 网易云构建期专辑详情 |
| 封面 | 网易云公开封面地址，构建期下载到本地 |
| 外部聆听入口 | 按 neteaseAlbumId 构造并校验的网易云专辑页 |
| 核心流派 | 可靠匹配时使用 RYM Primary Genres；未匹配时只保留人工确认值 |
| 相关流派 | 仅使用可靠匹配的离线 RYM Secondary Genres |
| 氛围与特征 | 仅使用可靠匹配的离线 RYM Descriptors |
| 场景、中文导览 | 本地策展层 |
| 市场频道 membership | 网易云新发行列表的发现上下文 |

MusicBrainz ID 不是目录必填字段，也不参与当前生产目录生成。Cover Art Archive 和 Apple 不参与当前生产刷新。RYM 只允许通过获准的本地离线快照进入构建流程；当前快照没有记录，刷新不会访问 RYM 网站。

## 匿名访问边界

刷新只使用 0.15A/0.15B 已验证的公开元数据路径：

- `POST /api/search/get`：首次固定缺失 albumId；
- `GET /api/artist/albums/:artistId`：只用于人工维护艺人 ID 的候选发现；
- `GET /api/v1/album/:id`：专辑详情和曲目；
- `POST /api/album/new`：仅在维护市场频道发现记录时使用。

请求只能访问 `music.163.com`；封面下载只允许 HTTPS 的 `music.126.net` 静态资源域名。流程不使用账号、Cookie、Token、自定义敏感请求头、浏览器数据、代理、播放地址、评论、用户数据或验证码绕过。

请求严格串行，间隔至少两秒，超时为二十秒；网络错误或 5xx 最多重试一次。401、403、429、验证码和风控信号不重试并立即停止对应刷新。日志只保存用途、公开路径、时间、状态、耗时和错误类别。

## 固定身份与发布

`scripts/catalog/netease-curated-artists.mjs` 定义人工选择的艺人 ID、核心流派和最大候选数；`discover-artist-albums.mjs` 生成可复核的固定候选。`scripts/catalog/netease-seeds.mjs` 合并中文优先的基础候选、扩展候选、本站分类与可选导览。`scripts/catalog/netease-identities.json` 固定 slug、艺人、标题和网易云 albumId，固定后搜索不能自动覆盖身份。

`pnpm catalog:refresh`：

1. 读取固定身份；
2. 仅为未固定候选执行专辑搜索；
3. 按 albumId 获取详情和曲目；
4. 下载公开封面到 `public/catalog/covers/`；
5. 规范化专辑、艺人、日期、公司、曲目、网易云链接和发现频道；
6. 用标题与别名、艺人、发行年份和发行类型对离线 RYM 记录执行唯一复合匹配；未匹配或多候选时只保留人工核心流派并清空相关流派与 Descriptors；
7. 执行唯一性、字段所有权、日期、链接、封面和必选样本校验；
8. 仅在全部校验通过时原子发布本地快照。

原始缓存位于被忽略的 `.cache/catalog/`，不会进入源码包或静态成品。列表、搜索和推荐读取不含曲目表的 `catalog-index.json`；详情静态生成单独读取 `catalog.json`，避免所有页面加载完整曲目数据。

## RYM taxonomy 边界

`scripts/catalog/rym-taxonomy-snapshot.json` 是唯一允许进入发布流程的离线 RYM taxonomy 输入。每条记录必须同时提供可核验的标题或别名、艺人、发行年份、发行类型和来源引用。只有唯一匹配才发布三类有序字段；零候选和多候选都不得猜测。

当前没有获准的 RYM 文件或人工核验记录，因此 319 张专辑均标记为未匹配，`relatedGenres` 和 `descriptors` 均为空。逐专辑匹配依据记录在 `reports/catalog/rym-taxonomy-audit.json`。该流程不登录、不抓取、不浏览 RYM，也不根据网易云或编辑元数据生成 fallback。

## 封面与缺失状态

封面成功下载后以 `{neteaseAlbumId}.jpg` 保存，不进行运行时热链。下载失败不会阻止真实专辑进入目录，快照改为 `fallback` 并在页面使用明确的本地图形占位；占位不冒充真实封面。

## 市场频道

`ALL`、`ZH`、`EA`、`JP`、`KR` 只能保存到 `sourceMarketChannels`。同一 albumId 在多个频道出现时合并为一张专辑并保留全部 membership。频道不映射为国家、地区、语言、国籍或法域。

## 风险

网易云匿名接口不是面向本项目承诺稳定性的正式 API。长期分页、增量同步、删除、字段变化、封面权利和平台规则仍需持续复核。任何限制信号都优先停止刷新，不能用登录、凭据、代理或规避手段维持采集。
