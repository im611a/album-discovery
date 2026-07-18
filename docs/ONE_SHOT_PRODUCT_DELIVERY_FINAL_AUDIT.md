# One-Shot Product Delivery 最终候选版审计

审计日期：2026-07-18

候选分支：`fix/one-shot-product-release-candidate`

修复起点：`3a6b9cf`

## 结论

**Verdict: PASS**

上一轮独立验收记录的 1 个 Blocker、5 个 Major 和 3 个 Minor 已全部关闭。候选版可以本地运行、完整测试、静态导出，并同时生成可复验的源码包与可部署静态网站包。它仍未合并 `main`、未推送、未部署，也没有开始真实用户数据或运行时音乐 Provider 接入。

## 问题关闭矩阵

| 原问题 | 处理 | 状态 |
|---|---|---|
| MusicBrainz 同名结果误选 | 建立 120 条固定身份清单；刷新按固定 MBID 读取并核对标题、艺术家、首发年份与主类型；校验器加入身份、类型、年份和曲目约束 | CLOSED |
| 测试降至 10 文件 / 27 用例 | 恢复目录身份、推荐、状态、搜索、发现、详情、路由、交付与可访问性契约测试；最终 30 文件 / 235 用例 | CLOSED |
| 想听不影响推荐、导入 like 可自荐 | 想听作为弱种子并排除自身；favorite/like 统一为强种子并排除自身；not-for-me/dismissed 统一为负向与排除信号 | CLOSED |
| 状态无迁移、超大文件先读取 | 增加可识别无版本状态迁移、未来版本拒绝、目录 ID 对账、冲突归一；100KB 在 `File.text()` 前检查 | CLOSED |
| 别名搜索无真实样本 | 保留数据字段但删除产品承诺；现行搜索只承诺标题、艺术家、类型、描述与场景 | CLOSED |
| 缺少静态成品包 | 增加静态打包与双包验证脚本，生成独立源码包和静态网站包 | CLOSED |
| 推荐理由暴露内部类型键 | 统一通过中文 taxonomy label 生成理由 | CLOSED |
| 文件输入缺少可访问名称 | 增加关联 label，并把隐藏输入移出 Tab 顺序；可见按钮负责触发 | CLOSED |
| AlbumCard 固定 h3 | 增加受控 heading level，页面结果默认 h2，嵌套区块使用 h3 | CLOSED |

## 固定目录身份

`scripts/catalog/verified-identities.json` 是发布身份权威，恰好包含 120 条互不重复的 MusicBrainz release-group ID。每条记录包含：

- 预期标题与主艺术家；
- 固定 release-group ID；
- 预期首发年份、MusicBrainz 主类型和发布类型；
- 可接受标题变体；
- 重点指南合理曲目下限；
- 复核说明与时间；
- 已保留并逐专辑复核的外部链接。

九个已知误选已更正：`paranoid`、`hounds-of-love`、`whats-going-on`、`is-this-it`、`since-i-left-you`、`black-sabbath`、`master-of-puppets`、`the-dreaming`、`heaven-or-las-vegas`。负面回归测试明确拒绝旧错误 ID，并验证 Hounds of Love 的 3 首错误曲目版本和 What’s Going On 的错误年份/类型不能发布。

当前快照：120 张专辑、24 份重点指南、12 个主类型、120 个唯一 ID、120 个唯一 slug、24 张带代表版曲目、24 张带至少一个核验外链、120 张明确 fallback 封面。没有 RYM 评分、虚构评分、虚构专辑、推测国家/地区/国籍字段或生产 Mock。

## 推荐与本机状态

推荐引擎保持纯 TypeScript、确定性和集中权重。结果排除种子、想听、喜欢、听过、dismissed 和 not-for-me 自身；想听提供弱相似度，喜欢提供更强相似度，不适合提供负向相似度。推荐理由只来自实际命中的类型、描述、场景、正向种子或编辑导览，类型显示为中文，不使用热度、评分或 AI 文案。

本机状态保持版本 1，可迁移可识别的无版本历史结构，拒绝未知未来版本；导入时过滤已移出目录的 ID，并统一 like/favorite、not-for-me/dismissed 冲突。损坏 JSON 和不可用 storage 不会让页面崩溃。导入在读取内容前检查 100KB；导出只包含版本化用户状态；重置保留确认与取消路径。

## 搜索、发现与页面闭环

- 搜索支持中文/英文标题、艺术家、发行类型、本站类型、描述和场景，忽略大小写与多余空格，结果去重并保持稳定顺序。
- 当前无经核验别名样本，因此不承诺别名搜索。
- 发现页支持组合筛选、稳定排序、URL 状态与空结果。
- 120 个详情 slug 全部静态生成；未知 slug 使用友好 404。
- 详情页只显示已核验元数据；无曲目或外链时显示明确缺失状态；外链均为 HTTPS 并带 `noopener noreferrer`。
- 页面具备 skip link、唯一主标题、合理的卡片标题层级、focus-visible 与 reduced-motion 规则。

## 数据源与网络边界

运行时前端只读取 checked-in 快照，不包含 `fetch`、XHR、WebSocket 或 EventSource 音乐 Provider 请求。本轮目录构建只访问 MusicBrainz 与 Cover Art Archive 官方端点；未访问网易云、RYM 或其他音乐数据源。MusicBrainz 请求串行限速、缓存、超时并使用可联系 User-Agent。Cover Art Archive 不可用时使用诚实 fallback，不热链图片。

## 自动质量证据

最终候选必须连续通过：

```text
pnpm catalog:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:source
pnpm package:static
pnpm delivery:verify
git diff --check
```

构建生成 132 个静态页面，其中包含 120 个专辑详情页及首页、发现、推荐、最近收录、搜索、我的专辑、设置、404、robots 和 sitemap。`delivery:verify` 解包检查两个 ZIP，确认静态包根目录直接包含 `index.html`、120 个详情目录与 `_next/static`，源码包不含 `.git`、`node_modules`、`.next`、`out`、缓存、环境文件或凭据。

## 交付物

- `artifacts/album-discovery-source.zip`：源码、测试、文档、固定身份清单与生成目录快照；不含构建产物或本地秘密。
- `artifacts/album-discovery-static-site.zip`：`out/` 根内容，可由普通静态 HTTP 服务器直接托管；不含源码、依赖或 Git 数据。

## 剩余非阻断限制

- 120 张是精选快照，不代表 MusicBrainz 全量目录。
- 24 份中文导览仍标记为 `metadata_based` 与 `humanReviewed: false`，不冒充专业评论。
- 当前环境未提供可编程浏览器控制接口；响应式与可访问性通过组件测试、静态 HTML/CSS、构建及本地静态 HTTP 路由检查验证，真实设备视觉仍建议在部署前做一次人工抽查。
- 当前封面均为明确标注的 fallback；若未来重新获取封面，仍需单独评估图片权利与部署边界。
