# 开源项目参考审计

审计日期：2026-07-15。

本次只读查看 GitHub 仓库元数据、README、LICENSE、发布记录、少量相关源码和
官方文档。没有 clone 仓库，没有运行其安装、构建或服务脚本，也没有调用网易
云接口。仓库活跃不等于上游接口稳定或使用方式合规；许可证记录也不构成法律
意见。

## 已确认事实总表

| 仓库 | 用途 | 已归档 | 许可证 | 维护状态证据 | 可参考接口/能力 |
| --- | --- | --- | --- | --- | --- |
| [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) | 历史网易云 Node.js API 服务 | 是，2024-04-16 起只读 | 当前归档仓库未展示许可证 | 代码已被版权提示替换，不再维护 | 只能作为历史背景，当前仓库无法审计原接口实现 |
| [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) | 非官方网易云 Node.js API 服务与模块库 | 否 | MIT | v4.37.0 发布于 2026-07-15 | 专辑搜索、新碟、专辑详情、艺术家专辑、曲目详情等 |
| [qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic) | Vue/Electron 第三方网易云播放器 | 否 | MIT | README 称现版本进入维护模式；0.4.10 发布于 2025-10-09 | API 消费与客户端交互模式，不是目录 API 提供方 |
| [navidrome/navidrome](https://github.com/navidrome/navidrome) | 自托管本地音乐库服务器和串流器 | 否 | GPL-3.0 | v0.63.2 发布于 2026-07-11 | 大型音乐库扫描、元数据组织、Subsonic 兼容 API |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | 可复制定制的组件代码与分发平台 | 否 | MIT | `@shadcn/react` 0.2.1 发布于 2026-07-08 | 组件注册表、CLI 配置、可访问组件模式 |
| [umami-software/umami](https://github.com/umami-software/umami) | 隐私导向的网站与产品分析平台 | 否 | MIT | v3.2.0 发布于 2026-06-24 | 采集 API、批次/事件处理、后台读模型与运维结构 |

## 网易云相关仓库

### Binaryify/NeteaseCloudMusicApi

**已确认事实**

- GitHub 明确标记仓库已由所有者归档并只读，README 仅保留“保护版权，此仓库
  不再维护”的说明。
- 当前仓库没有可供本次审计的原实现，也没有展示 LICENSE；不能因为历史分支、
  fork 或其他项目的声明而替当前仓库认定许可证。
- 仓库描述仍为“网易云音乐 Node.js API service”，但描述不能证明代码或服务
  仍可用。

**工作原理、接口与账号依赖**

当前仓库内容不足，无法从本仓库确认历史工作原理、接口清单或 Cookie 依赖。
任何关于其历史逆向协议、匿名能力或登录行为的描述都应视作外部背景，而不是
本次确认事实。

**稳定性风险与不直接集成原因**

仓库已归档、实现被移除、当前许可证不明确且存在显式版权提示，因此不能直接
集成、vendor 或作为生产依赖。它只用于说明生态历史。

### NeteaseCloudMusicApiEnhanced/api-enhanced

**已确认事实**

- 仓库未归档，采用 MIT 许可证；README 将其描述为第三方网易云 Node.js API，
  当前有近期发布与持续提交。
- README 列出登录、用户、歌曲、专辑、歌手、搜索等大量接口类别，并提醒敏感
  Cookie 应使用环境变量。
- 只读源码显示，每个模块把本地函数/HTTP 路由映射到上游路径，并通过共享请求
  层构造 Cookie、User-Agent 与 `weapi`/`eapi` 等加密选项。
- 与本项目相关的模块包括：专辑搜索（类型 10）、全部新碟、最新专辑、艺术家
  专辑、专辑详情和曲目详情。

**账号、Cookie 或登录依赖**

公共模块的选项层接受调用参数中的 Cookie 或 `NETEASE_COOKIE` 环境变量；请求
层也会构造匿名状态。哪些目录能力在 2026-07-15 实际无需账号、匿名令牌如何
失效、是否会触发风控，均未通过真实请求确认。

**稳定性风险**

- 它依赖非官方、可能变化的上游路径、客户端参数和加密协议。
- 上游可随时改变响应、风控、地区限制、Cookie 要求或限流。
- 仓库活跃和接口数量不能替代服务条款、封面使用与批量访问复核。
- 项目还包含登录、解锁、播放等远超本站范围的能力，扩大供应链和合规风险。

**不直接集成的原因**

0.1 只把它当作接口词汇和实验设计参考。正式采用前必须在 0.15 以最小、匿名、
低频实验验证目录子集，并评估是否应隔离为自有适配器；不能把整个项目作为
本站运行时依赖，也不能启用登录、解锁或音频能力。

### qier222/YesPlayMusic

**已确认事实**

- 仓库未归档并采用 MIT；README 称全新 2.0 处于 Alpha，当前旧版进入维护
  模式，除重大 bug 外不再增加功能。
- 它是 Vue/Electron 客户端，README 明确说明由 NeteaseCloudMusicApi 提供 API。
- 功能包含网易云账号登录、播放、MV、歌词、私人 FM 和每日推荐；这些都不是
  本项目第一版范围。

**工作原理、接口与账号依赖**

它消费第三方网易云 API 并在 Web/Electron 客户端管理界面和播放体验，而不是
向本站提供稳定目录接口。个性化、海外播放和账户内容明确依赖网易云登录；
普通公开浏览是否匿名可用没有在本次审计中实测。

**稳定性风险与不直接集成原因**

旧版维护模式、客户端/播放导向、账户与解锁能力，以及对第三方 API 的二级依赖
都与本站“离线目录 + 外部收听链接”架构不符。可借鉴的是专辑信息层级和外部
服务失败时的客户端状态意识，不复制页面、不继承其登录或播放功能，也不把
README 中的 Last.fm Scrobble 当作本站正式数据源或功能。

## 通用工程参考仓库

### navidrome/navidrome

**已确认事实**

- 仓库未归档、使用 GPL-3.0，近期仍持续发布。
- README 将其定义为自托管音乐集合服务器和串流器：扫描本地音乐元数据，维护
  多用户音乐库，通过 Web 与 Subsonic 兼容客户端提供浏览和转码播放。
- 它依赖自有本地媒体文件和本地用户账号，不提供网易云或 RYM 数据。

**可借鉴与不直接集成原因**

可参考大型音乐库的扫描批次、元数据分层、合辑/多碟处理和稳定发布版本意识。
它的本地文件扫描、用户系统、收藏、播放、转码和 GPL-3.0 代码复用义务均不
符合本站当前范围；不作为依赖，不把其数据当作正式来源，代码复用需另行法律
评审。

### shadcn-ui/ui

**已确认事实**

- 仓库未归档、使用 MIT，仍在活跃发布。
- 项目定位是可定制组件和代码分发平台；CLI 根据 `components.json` 将选定组件
  代码加入使用者仓库，而不是提供一个必须整体运行的远程 UI 服务。
- 官方文档确认 React 19 与 Tailwind 4 可用；Tailwind 4 的配置文件路径应留空，
  并可通过 `cn` 工具组合 `clsx` 与 `tailwind-merge`。

**账号依赖、风险与使用边界**

本地配置和组件生成不需要产品用户账号或 Cookie。风险主要来自 CLI/组件版本
变化和批量生成覆盖现有代码。本项目只做最小配置，按需逐个添加组件；不安装
未使用组件、不 vendor 整个仓库，也不因此开始页面开发。

### umami-software/umami

**已确认事实**

- 仓库未归档、使用 MIT，近期仍持续发布。
- 它是 Next.js/TypeScript 分析平台，跟踪数据通过服务端接口进入持久化存储，
  再由管理界面读取聚合结果；自托管安装要求数据库和管理员账号。
- 它不提供音乐目录、网易云字段或 RYM 字段。

**可借鉴与不直接集成原因**

可参考写入路径与读取模型分离、隐私意识、批次/事件校验和运维文档结构。站点
分析、管理员用户、Prisma/PostgreSQL 和跟踪脚本均不属于 0.1，也不是第一版
已经批准的产品能力；因此不安装、不运行、不接入。

## 推测（不是实测结论）

- api-enhanced 是目前最适合定义 0.15 接口类别和响应假设的公开实现，但非官方
  协议意味着维护成本可能显著高于普通公开 API。
- 专辑搜索、新碟、艺术家专辑、详情和曲目理论上可以组成目录发现链；覆盖率和
  匿名可用性仍未知。
- Navidrome 和 Umami 的“采集/写入与发布/读取分离”模式适合本站的离线快照
  方向，但这里只借鉴架构原则，不复制实现。
- YesPlayMusic 的交互能力不应被误读为本项目需求；它更多说明账号和播放功能会
  快速扩大范围与风险。

## 等待 0.15 验证

- 目录接口真实状态码、响应结构、字段完整度和分页行为；
- 无个人 Cookie 时的匿名能力、匿名令牌生命周期和区域差异；
- 低频访问的延迟、错误率、429/风控阈值和停止条件；
- 官方专辑链接模板与下架/重定向行为；
- 适用条款、批量访问、缓存封面和数据保留边界；
- 是否值得实现窄适配器，还是应判定网易云目录方案不可行。

这些项目均未完成真实网易云可行性验证，本次也未访问或抓取 RYM。

## 主要一手来源

- [Binaryify 归档仓库](https://github.com/Binaryify/NeteaseCloudMusicApi)
- [api-enhanced README](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced#readme)
- [api-enhanced LICENSE](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/LICENSE)
- [YesPlayMusic README](https://github.com/qier222/YesPlayMusic#readme)
- [YesPlayMusic LICENSE](https://github.com/qier222/YesPlayMusic/blob/master/LICENSE)
- [Navidrome README](https://github.com/navidrome/navidrome#readme)
- [Navidrome LICENSE](https://github.com/navidrome/navidrome/blob/master/LICENSE)
- [shadcn/ui README](https://github.com/shadcn-ui/ui#readme)
- [shadcn/ui `components.json` 文档](https://ui.shadcn.com/docs/components-json)
- [shadcn/ui Tailwind 4 文档](https://ui.shadcn.com/docs/tailwind-v4)
- [Umami README](https://github.com/umami-software/umami#readme)
