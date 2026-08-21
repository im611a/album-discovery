# 现行架构

## 发布数据流

```text
本地 JSON/CSV 审核种子
→ 可恢复网易云构建期同步（缓存、检查点、限频、有限重试）
→ 候选目录规范化和完整校验
→ 可选离线 RYM 唯一复合匹配
→ 原子发布轻量专辑索引、逐专辑详情和艺人索引
→ 本地查询、推荐与探索算法
→ App Router 静态页面
→ 浏览器本机个人状态
```

浏览器只读取随站点发布的本地快照。Provider 请求、缓存、检查点与失败日志不进入前端依赖。

## 快照拆分

- `catalog-index.json`：列表、搜索、发现和推荐使用的轻量专辑字段，不含曲目、公司、外链和来源对象；
- `catalog-index.manifest.json`：记录轻量索引版本、数量、字节数与 SHA-256；357 张规模保持一个分片，超过升级阈值后可按相同契约拆分；
- `album-details/*.json`：每张专辑一个详情文件，只在对应静态详情构建时读取；
- `artist-index.json`：艺人身份、专辑数量、类型统计、年份范围、常见核心流派和关联专辑；
- `catalog.json`：维护与校验使用的完整稳定快照，不进入共享浏览器列表模块。

357 张详情与 300 位艺人都在构建时生成静态路由。没有数据库。

专题页在构建期从轻量索引预计算真实 key、数量、常见核心流派和最多四张封面预览。详情、发现、搜索和专题不会加载其他专辑的曲目文件。纯静态逐专辑与逐艺人页面仍会随目录线性增长；数万条目录需要重新评估详情路由部署方式。

## 模块边界

- `scripts/catalog/**`：同步、缓存、规范化、校验、可选 RYM 增强、封面优化和原子发布；
- `src/data/generated/**`：确定性发布快照；
- `src/catalog/**`：轻量查询、搜索、分类显示和确定性推荐；
- `src/catalog/exploration.ts`：相似专辑、探索选项、艺人接力和稳定随机 seed，不依赖 React 或 Provider；
- `src/features/personal-state/**`：版本化本机状态、迁移、目录 ID 对账和损坏恢复；
- `src/components/**`：只消费发布模型，不了解上游响应；
- `src/app/**`：静态路由、页面结构和元数据。
- `src/config/editorial-home.ts`：只保存首页版位和目录 slug，不复制专辑数据；
- `src/components/editorial/**`：复用封面、专辑状态和发布模型的编辑型展示；
- `tests/e2e/**`：对静态 `out` 执行 Playwright 功能与本站视觉基准，不访问音乐 Provider。

运行时动画只有 Anime.js 4.5.0。动画作用域位于首页客户端边界，业务查询、推荐、
筛选和发布数据仍是纯本地模块；禁用或加载失败时不影响内容可见性。

## 同步安全

`catalog:sync` 对种子去重并按固定批次顺序处理。原始响应优先使用本地缓存；resume 从检查点继续；失败记录结构化原因。候选验证失败或单项失败时不发布，因此稳定目录不会被半成品覆盖。网易云更新字段与 RYM 字段分开合并，避免清除已有可靠增强数据。

RYM 导入器流式读取 CSV/TSV/JSONL，并支持 JSON、BOM、dry-run、limit、检查点和 resume。导入先写候选快照并执行完整目录校验，成功后再原子发布。原始研究数据只存在于被忽略的 `.local-data/rym/`。

候选发布使用显式 Album write-set。仅 write-set 内的新建或获准更新记录可以根据候选资产目录重新解析封面路径；不在 write-set 内的稳定基线 Album 必须保持完整语义等价，不能因为候选目录只包含本批资产而触发封面回退、字段重算或其他隐式改写。候选验证会逐一比较所有未触及基线 Album，并在出现任何漂移时拒绝该候选。

Content Pipeline 的 production promotion 是离线单写者事务，不与开发服务器、构建或静态发布并发。prepare 阶段把候选 write-set 复制到批次内的 transaction shadow/ready 区，记录 production BEFORE、候选 AFTER、精确目标路径和同卷假设，并以同步临时文件加原子替换更新 journal。promote 在第一次 production mutation 前重新验证全部 BEFORE fingerprint；随后仅使用同卷原子 rename 执行逐路径可逆替换。多路径期间 journal 的 `PROMOTING` 不是可发布状态，只有所有路径与候选一致且后置验证通过后的 `COMMITTED` 才是下游可见提交边界。普通异常回滚到 BEFORE；进程中断由 `recoverTransaction` 根据 durable progress、backup、destination 和 candidate shadow 的 hash 确定性回滚。任何无法由 journal 解释的状态都会 fail closed，且 promotion 不移动或改写 canonical candidate。

## Bulk Operator V1

正式运维入口是 `album-import.ps1 → scripts/catalog/content-pipeline/operator.mjs → Content Pipeline V1 core`。PowerShell 是无业务逻辑的参数/退出码转发层；Operator 只负责 command routing、workspace lifecycle、locks、human authorization gates 和结果 envelope，不复制 parser、normalizer、validator、publisher 或 transaction/recovery engine。

只有显式 `acquire` command 可以产生外部 HTTP GET，并只按输入中的 NetEase Album ID 写入 `.local-data/content-pipeline-v1/CONTENT-BATCH-*`。doctor、dry-run、status、review、prepare、promote、recover 都是 offline。Review overlay 只允许绑定 batch + input SHA 的既有 `NEEDS_REVIEW` code，不能覆盖 ERROR/FATAL/source defect。Prepare 只生成 PREPARED journal；promote 必须同时匹配 exact transaction ID 与 candidate fingerprint。Per-batch lock 防止 workspace 双写，production global lock 序列化 prepare/promote/recover；non-terminal journal 优先进入 recovery，不能靠删 stale lock 绕过。

## 静态交付

Next.js 使用 `output: "export"`。列表图片读取 360px WebP 缩略图，详情读取最高 960px WebP；原始 JPG 不进入交付 ZIP。静态站点根目录包含构建标识，深层路由使用目录式 `index.html`。

`pnpm release:prepare` 在干净提交上依次执行目录校验、lint、类型检查、测试、构建、静态 HTTP 检查、双 ZIP 临时打包和交付验证；全部成功后才替换根目录交付包。
