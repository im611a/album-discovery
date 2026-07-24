# RYM 离线增强审计

## 输入查找与选择

仓库、项目内 `data/`、`fixtures/`、`imports/`、`artifacts/`、`docs/`、`scripts/` 以及项目父目录中没有可直接导入的完整 RYM 数据。

本次比较了两个无需登录即可公开下载的候选：

| 候选 | 下载页面 | 格式与大小 | 字段 | 许可 | 结论 |
|---|---|---:|---|---|---|
| RATE YOUR MUSIC TOP ALBUMS | `kaggle.com/datasets/tobennao/rate-your-music-top-albums` | CSV，约 816 KB，2000 行 | 标题、艺人、年份、评分、人数、Primary、Secondary | 页面标注 Unknown | 可用，但覆盖较小 |
| Rate Your Music Top 5000 | `kaggle.com/datasets/tobennao/rym-top-5000` | 清洗 CSV，约 1.17 MB，5000 行 | 标题、艺人、年份、发行类型、评分、人数、Primary、Secondary、Descriptors | 页面标注 Unknown | 字段更完整，采用 |

采用输入标识为 `kaggle:tobennao/rym-top-5000`，归类为 `PERSONAL_RESEARCH_INPUT`，不宣称 RYM 官方授权。原始输入位于 `.local-data/rym/`，未进入 Git、源码 ZIP 或静态 ZIP。采用文件 SHA-256：

`272cc798cb1d1058048500485d1668855d9a251bb19fef9e52beaae81a8ec6b7`

## 导入结果

| 指标 | 数量 |
|---|---:|
| 目录专辑 | 319 |
| MATCHED_EXACT | 13 |
| MATCHED_ALIAS | 0 |
| MATCHED_STRONG | 0 |
| NOT_FOUND | 305 |
| AMBIGUOUS | 0 |
| REJECTED | 1 |
| 有评分 | 13 |
| 有评分人数 | 13 |
| 有相关流派 | 11 |
| Secondary Genres 出现次数 | 28 |
| 唯一 Secondary Genres | 24 |
| 核心流派调整 | 0 |

主要未匹配原因是 5000 行榜单对中文和长尾目录覆盖有限；唯一 REJECTED 来自发行类型冲突。匹配没有降级为仅标题或仅艺人，也没有要求人工逐张确认。

## 数据边界

- Primary Genres 仅用于审计，没有自动覆盖人工核心流派。
- 只有 RYM Secondary Genres 进入“相关流派”，保持输入顺序；没有则为空数组。
- Descriptors 在输入边界可解析，但不会进入发布快照的前端字段、筛选、详情、搜索或推荐。
- 评分与人数来自同一离线记录；无评分保持 `null`，不使用 0 或推算值。
- 浏览器运行时 RYM 请求次数为 0；没有 RYM 在线抓取逻辑。
- 详细逐专辑状态保存在 `data/rym/enrichment-summary.json`，结构化运行报告保存在 `reports/catalog/rym-enrichment-report.json`。

## 已知限制

输入许可未说明，只适用于个人研究输入，不应重新分发。5000 行榜单不能代表 RYM 全量目录，当前 13 张匹配也不能证明对中文专辑的普遍覆盖能力。
