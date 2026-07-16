# 专辑发现

## 项目定位

专辑发现是一个面向中文用户的轻量专辑目录，用于浏览、筛选、搜索并了解完整音乐专辑。
当前 v0.2 是静态产品原型，全部页面只使用完全虚构的本地 Mock 数据，不包含任何真实
音乐数据请求。

后续版本计划通过网易云目录同步层提供专辑、封面、曲目和唯一外部收听入口，通过 RYM
离线导入层提供评分、评分人数与分类信息；这些真实数据能力尚未接入。

## 当前页面

| 路由 | 用途 |
| --- | --- |
| `/` | 首页发现入口 |
| `/discover` | 专辑筛选与排序 |
| `/new-releases` | 新发行市场频道与发行类型筛选 |
| `/search` | 按专辑名称、别名或艺术家搜索 |
| `/albums/[slug]` | 专辑详情；当前生成 18 条静态详情路由 |
| 框架级 404 | 未知专辑和不存在地址的友好返回状态 |

## 当前功能

- 首页近期发行、高分专辑、按流派探索和随机发现；
- 发现页年代、发行类型、RYM 分类筛选与排序，并用 URL 保存状态；
- 新发行页 `ALL`、`ZH`、`EA`、`JP`、`KR` 市场频道、发行类型筛选、去重与日期排序；
- 专辑名称、别名和艺术家名称的中英文搜索；
- 专辑详情、虚构 RYM 评分与分类、曲目表，以及禁用的网易云入口原型；
- 18 个静态详情路由、友好 404、响应式布局和键盘操作支持。

网易云市场频道只表示专辑从哪个新发行来源列表被发现，不代表国家、地区、语言、法域
或艺术家国籍。

## 明确不做

v0.2 不包含用户系统、评论、收藏、用户评分、在线播放、热度、国内／国外分区、国家、
语言或国籍筛选、多平台入口、真实数据请求、数据库或正式数据 Provider。

## 技术栈

版本均来自当前 `package.json`：

- Next.js `16.2.10`
- React / React DOM `19.2.4`
- TypeScript `^5`
- Tailwind CSS `^4`
- Vitest `^4.1.10`
- React Testing Library `^16.3.2`
- pnpm `11.7.0`（`packageManager` 声明）

## 本地命令

```text
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 文档入口

- [产品规格](./docs/PRODUCT_SPEC.md)
- [信息架构](./docs/INFORMATION_ARCHITECTURE.md)
- [v0.2 文件级计划与完成记录](./docs/V0.2_PLAN.md)
- [v0.2 历史代码审计](./docs/V0.2_CODE_AUDIT.md)
- [路线图](./docs/ROADMAP.md)
- [Aleksi Codex 规划方法](./docs/ALEKSI_CODEX_PLANNING_METHOD.md)
