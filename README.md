# 专辑发现

面向中文用户的静态专辑发现网站。产品把网易云专辑目录、本地策展分类、可解释推荐和只保存在浏览器中的个人专辑状态连接成一条无需账号的使用路径。

## 当前能力

- 319 张以网易云 albumId 固定身份的真实专辑，中文音乐为目录核心；
- 人工确认的核心流派，以及仅在可靠离线 RYM 匹配存在时发布的相关流派与氛围特征；
- 首页、发现、为你推荐、最近收录、搜索、我的专辑、设置和静态专辑详情；
- 确定性本机推荐，以及想听、喜欢、听过、不适合我的本地状态；
- 所有专辑详情、封面、曲目与外部链接在构建前发布为本地快照；
- 完整 Next.js 静态导出，不要求运行 Next.js 服务器。

浏览器不会实时访问网易云、MusicBrainz、RYM 或其他音乐数据源。专辑详情的唯一外部音乐操作是“在网易云音乐中查看”。

## 本地开发

```text
pnpm install --frozen-lockfile
pnpm dev
```

## 质量检查

```text
pnpm catalog:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 目录刷新

```text
pnpm catalog:refresh
pnpm catalog:validate
```

刷新只在构建维护阶段运行，使用 Node.js 自带 `fetch` 串行访问已验证的网易云匿名公开专辑元数据路径。它不使用账号、Cookie、Token、浏览器数据、代理、验证码处理或访问限制绕过。请求间隔至少两秒，遇到 401、403、429、验证码或风控信号立即停止。

专辑身份固定在 `scripts/catalog/netease-identities.json`。固定后直接按 albumId 读取详情；扩展候选只从明确的艺人 ID 专辑目录产生，并复核标题、艺人 ID、发行年份、类型和曲目数。规范化详情快照与轻量列表索引发布到 `src/data/generated/`，封面保存到 `public/catalog/covers/`，缓存与必要请求日志只保存在被 Git 忽略的 `.cache/catalog/`。

## 静态交付

```text
pnpm package:source
pnpm package:static
pnpm delivery:verify
pnpm serve:static
```

- `album-discovery-source.zip`：源码、测试、文档、固定身份和已发布快照。
- `album-discovery-static-site.zip`：可以直接部署的 `out/` 静态成品。

两个压缩包均排除 Git、依赖、构建缓存、环境文件、Cookie、Token 和原始缓存响应。

## 数据边界

- 网易云音乐：专辑身份、标题、艺人、别名、发行信息、公司、封面、曲目和唯一外部专辑入口。
- 本地编辑层：未匹配专辑的人工核心流派、聆听场景及中文导览。
- RYM 离线层：只有可靠匹配后才发布 Primary Genres、Secondary Genres 和 Descriptors，并保持来源顺序；当前快照没有获准的 RYM 记录。
- 市场频道：`ALL`、`ZH`、`EA`、`JP`、`KR` 只记录发现来源，不代表国家、地区、语言或国籍。
- 不访问或抓取 RYM；不展示未经离线来源确认的 RYM 分类、虚构评分、播放量、评论数或平台统计。

更完整的产品、架构和刷新边界见 [docs](./docs/README.md)。
