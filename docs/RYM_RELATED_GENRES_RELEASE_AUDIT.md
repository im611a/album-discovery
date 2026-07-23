# RYM 可选 Taxonomy 集成审计

## 发布结论

**状态：PASS**

本版本把 RYM taxonomy 作为可选、构建期、离线数据源：存在唯一可靠匹配时才发布
Primary Genres、Secondary Genres 和 Descriptors；没有记录或无法唯一匹配时，保留
人工确认的核心流派，并让相关流派与氛围特征保持空数组。匹配数量为零不会阻塞
产品交付，也不会触发猜测、生成式补齐或运行时请求。

当前离线快照没有记录，因此本次没有发布任何 RYM 分类，也没有调整核心流派。
发现页仍固定提供“相关流派”和“氛围与特征”筛选结构；空数据时控件只显示“全部”。
详情页只在对应数组非空时显示区块。

## Git 与数据基线

| 项目 | 结果 |
| --- | --- |
| 分支 | `fix/rym-related-genres-release` |
| 起始提交 | `fdfff84` |
| `main` | `1573eba`，未合并 |
| tag | `v0.2.0-prototype`，未操作 |
| stash | `backup: legacy v0.2 plan before 0.2P`，未操作 |
| 目录专辑 | 319 |
| 唯一网易云 ID / slug | 319 / 319 |

## 离线数据来源与匹配

唯一允许进入构建流程的输入是
`scripts/catalog/rym-taxonomy-snapshot.json`。当前内容：

- `version`: 1
- `records`: 0
- `importedAt`: `null`
- 来源说明：当前没有获准的离线 RYM taxonomy 文件或人工核验记录

本次检查了仓库既有文件和可公开取得的离线数据候选；没有找到同时具备清晰使用
许可、稳定下载文件、专辑身份字段以及 Primary/Secondary/Descriptors 的数据集。
非官方实时抓取服务、爬虫代码、搜索摘要和许可证不清晰的数据均未导入。没有访问
RYM 页面、隐藏接口或网易云，也没有把人工 CSV 作为发布前置条件。

| 匹配结果 | 数量 |
| --- | ---: |
| MATCHED | 0 |
| NOT_FOUND / 当前无离线候选 | 319 |
| AMBIGUOUS | 0 |
| REJECTED | 0 |

逐专辑的标题与别名、完整艺人、发行年份和发行类型证据保存在
`reports/catalog/rym-taxonomy-audit.json`。匹配器只有在四类身份条件形成唯一候选时
才采用离线记录；零候选和多候选均不发布 RYM 字段。

## Taxonomy 结果

| 指标 | 数量 |
| --- | ---: |
| 人工核心流派 | 15 个稳定 key |
| 核心流派调整 | 0 |
| 拥有相关流派的专辑 | 0 |
| 相关流派唯一词条 | 0 |
| 相关流派赋值 | 0 |
| Descriptors 唯一词条 | 0 |
| Descriptors 赋值 | 0 |

快照校验器要求非空记录具备复合身份、来源引用和有效导入时间；拒绝空白/非法 key、
单字段重复值，以及 Primary 与 Secondary 之间的重复 key。发布层保持离线记录中的
顺序，不生成 fallback。

## 聆听场景审计

聆听场景继续保留为本站独立策展字段：

| 指标 | 数量 |
| --- | ---: |
| 场景词条 | 13 |
| 场景赋值 | 637 |
| 具有场景的专辑 | 319 |

场景来自 `scripts/catalog/netease-curated-artists.mjs` 中明确标注的编辑规则，与
Secondary Genres 和 Descriptors 使用不同字段、不同筛选参数和不同展示说明。
它们不参与 RYM 匹配，也不会被转换成 RYM taxonomy。

## 可选人工维护工具

`data/rym/verified-album-taxonomy.template.csv` 保留为可选维护工作单，不是发布门槛：

- 50 行候选、50 个唯一网易云 ID、50 个唯一 slug；
- 48 个唯一艺人组合、覆盖 14 个核心流派；
- 覆盖 1970—2020 年代，以及 Album 和 EP；
- 所有 RYM 状态、引用和分类字段均为空；
- UTF-8 BOM，可由 Excel 和常规 CSV 解析器读取。

填写规范见 `docs/RYM_MANUAL_VERIFICATION_GUIDE.md`。只有用户明确提供完成的合法
离线文件并要求导入后，才进入校验、dry-run 和幂等导入流程。

## 产品与浏览器验收

- 发现页始终显示核心流派、相关流派、氛围与特征、本站策展场景、年代、类型和排序；
- 空 taxonomy 下，相关流派与氛围控件各只有“全部”，不生成虚假选项；
- 选项由实际发布数据构造，旧的无效 URL 参数会安全忽略；
- 详情页只在非空时显示相关流派或氛围区块；
- 《在雨后醒来》和《超级孙先生》保留核心流派，不显示空的 RYM 区块；
- 360px 与 1280px 对 10 个关键路由的静态浏览器抽查均无横向溢出；
- 所有抽查页面只有一个 `h1`，未知专辑返回友好 404；
- 控制台无错误，运行时外部请求为 0；
- 深层详情页及 Next 静态 RSC 文本均可由普通本地 HTTP 服务直接访问。

## 自动质量门

| 检查 | 结果 |
| --- | --- |
| `pnpm catalog:validate` | PASS：319 张、319 个唯一 ID/slug、319 个本地封面/曲目/网易云链接 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS：32 个测试文件、773 个用例 |
| `pnpm build` | PASS：331 个静态页面，含 319 个专辑详情路由 |
| `git diff --check` | PASS（仅 Git 的 LF/CRLF 提示，无空白错误） |

新增回归覆盖了可选 taxonomy 的重复/层级冲突、动态筛选选项、空 taxonomy 控件、
详情页条件展示，以及静态导出 RSC 路径解析。

## 交付包

| 文件 | 条目 | 用途 |
| --- | ---: | --- |
| `album-discovery-source.zip` | 485 | 可复现安装、测试与构建的源码包 |
| `album-discovery-static-site.zip` | 4270 | 可直接部署的静态网站成品 |

静态包包含 319 个详情页面，可由普通静态 HTTP 服务部署。源码包排除 `.git`、
`.next`、`out`、`node_modules`、缓存、环境文件和交付 ZIP；静态包只包含 `out`
成品。

## 独立最终审计

| 级别 | 数量 | 结论 |
| --- | ---: | --- |
| Blocker | 0 | 无阻止构建、静态交付或提交的问题 |
| Major | 0 | 无数据伪造、空 UI、运行时外部请求或静态导航缺陷 |
| Minor | 0 | 无需在本版本内继续修复 |

## 剩余限制

- 当前没有获准的非空离线 RYM 数据，因此实际相关流派和 Descriptors 仍为 0；
- 这表示“暂无可靠数据”，不表示 RYM 没有对应条目；
- 未来导入仍需合法离线来源、唯一复合匹配和人工处理歧义；
- 当前人工核心流派是本站最低限度策展，不应被描述为 RYM Primary Genres；
- 本版本没有合并 `main`、推送远程、移动 tag 或操作 stash。
