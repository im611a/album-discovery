# RYM taxonomy correction 审计

审计日期：2026-07-23

## 结论

仓库当前没有合法、获准且可核验的离线 RYM taxonomy 记录，也没有用户提供的 RYM 文件。因此本次没有把任何专辑猜测匹配到 RYM：68 张专辑全部保持未匹配，只保留原有人工确认的核心流派，`relatedGenres` 与 `descriptors` 全部清空。

修正前共有 82 条相关流派分配和 180 条描述词分配；修正后均为 0。没有改动网易云专辑身份、曲目、封面或外链。

## 匹配规则与证据

构建期匹配器只读取 `scripts/catalog/rym-taxonomy-snapshot.json`，并同时核对标题与别名、艺人、发行年份和发行类型。只有四项全部一致且候选唯一时才接受匹配；零候选或多候选都保持未匹配。匹配成功时按离线记录原始顺序发布 Primary Genres、Secondary Genres 和 Descriptors。

当前离线快照的 `records` 为空。逐专辑匹配状态、四项匹配依据和候选引用保存在 `reports/catalog/rym-taxonomy-audit.json`。刷新、构建和浏览器均不访问 RYM 网站，也不使用网易云标签、标题、艺人风格、相似专辑或模型生成 taxonomy fallback。

## 数据统计

| 指标 | 结果 |
|---|---:|
| 专辑总数 | 68 |
| 可靠 RYM 匹配 | 0 |
| 未匹配 | 68 |
| 多候选歧义 | 0 |
| 人工核心流派词条 | 15 |
| 相关流派词条 | 0 |
| 描述词条 | 0 |
| 移除的相关流派分配 | 82 |
| 移除的描述词分配 | 180 |

## 抽样复核

下表覆盖中文与国际专辑、1950 至 2020 年代、Album/EP/Single、多艺术家、长标题以及重点指定样本。每行均重新核对审计报告中的标题与别名、艺人、年份和发行类型；因为没有获准离线 RYM 候选，状态均为未匹配。

| 专辑 | 艺人 | 年份 | 类型 | 保留的人工核心流派 | RYM 状态 | 相关流派 / 描述 |
|---|---|---:|---|---|---|---:|
| 在雨后醒来 | 艾志恒Asen | 2025 | Album | hip-hop | 未匹配 | 0 / 0 |
| 超级孙先生 | SASIOVERLXRD | 2025 | Album | hip-hop | 未匹配 | 0 / 0 |
| 范特西 | 周杰伦 | 2001 | Album | pop | 未匹配 | 0 / 0 |
| 浮躁 | 王菲 | 1996 | Album | experimental-pop | 未匹配 | 0 / 0 |
| 黑梦 | 窦唯 | 1994 | Album | rock | 未匹配 | 0 / 0 |
| 冀西南林路行 | 万能青年旅店 | 2020 | Album | rock | 未匹配 | 0 / 0 |
| Cassa Nova | 落日飛車 Sunset Rollercoaster | 2018 | Album | dream-pop | 未匹配 | 0 / 0 |
| Arthropods | 33EMYBW | 2019 | Album | electronic | 未匹配 | 0 / 0 |
| 山歌寥哉 | 刀郎 | 2023 | Album | folk | 未匹配 | 0 / 0 |
| 窗边盼望 | 吴宇深 / 小羊unicorn | 2026 | Single | 暂无人工核心流派 | 未匹配 | 0 / 0 |
| Rumours | Fleetwood Mac | 1977 | Album | rock | 未匹配 | 0 / 0 |
| Blue | Joni Mitchell | 1971 | Album | folk | 未匹配 | 0 / 0 |
| BEYONCÉ | Beyoncé | 2013 | Album | pop | 未匹配 | 0 / 0 |
| First Love | 宇多田ヒカル | 1999 | Album | pop | 未匹配 | 0 / 0 |
| 12 | 坂本龍一 | 2023 | Album | ambient | 未匹配 | 0 / 0 |
| OK Computer | Radiohead | 1997 | Album | alternative-rock | 未匹配 | 0 / 0 |
| loveless | My Bloody Valentine | 1991 | Album | dream-pop | 未匹配 | 0 / 0 |
| To Pimp a Butterfly | Kendrick Lamar | 2015 | Album | hip-hop | 未匹配 | 0 / 0 |
| Madvillainy | Madvillain / MF DOOM / Madlib | 2004 | Album | hip-hop | 未匹配 | 0 / 0 |
| Kind of Blue | Miles Davis | 1959 | EP | jazz | 未匹配 | 0 / 0 |
| Master Of Puppets | Metallica | 1986 | Album | metal | 未匹配 | 0 / 0 |

《在雨后醒来》和《超级孙先生》均没有可靠离线 RYM 条目；两者只保留人工确认的 `hip-hop` 核心流派，没有相关流派或描述词。

## 展示与兼容性

- 数据层使用稳定英文 key。
- 只有存在公认中文译名时才显示 `中文（English）`；否则直接显示英文。
- 专辑详情不渲染空的相关流派或氛围与特征区块。
- 发现页只从实际发布值构造选项，不产生空白选项。
- 旧 URL 中不存在的 `secondary` 或 `descriptor` 参数会被安全忽略。
- 搜索、推荐、个人状态和静态路由继续消费同一发布快照；没有引入运行时 Provider。

## 独立只读复审

独立复审重新读取了匹配器、目录校验器、刷新流程、生成快照、筛选构造、详情展示、测试和交付脚本，并逐项核对 68 行匹配审计。

复审最初发现两个相关缺口：多艺人匹配只要求任一艺人重合，以及非空离线快照下目录校验没有逐专辑复算三组有序 taxonomy。两项均会降低“可靠唯一匹配”的保证，按 Major 处理。修正后，匹配要求完整规范化艺人集合一致；目录校验使用同一纯匹配器逐专辑复算，并要求发布的 Primary、Secondary 和 Descriptors 与唯一离线记录完全一致且顺序不变。新增测试覆盖部分艺人冲突、多艺人顺序无关、精确有序发布和快照外值拒绝。

最终复审结果：

- Blocker：0
- Major：0
- 已关闭 Major：2
- 目录刷新：68 张专辑，0 次外部请求
- 目录校验：通过
- lint：通过
- typecheck：通过
- tests：31 个文件、263 个用例全部通过
- build：80 个静态页面，其中 68 个专辑详情路由
- `git diff --check`：通过
- RYM 生产网络请求：0
- 静态网站包和源码包：生成并验证通过

**Verdict: PASS**
