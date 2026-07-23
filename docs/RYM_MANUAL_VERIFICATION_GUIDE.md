# RYM 人工核验工作单填写指南

## 工作单定位

工作单位于：

`data/rym/verified-album-taxonomy.template.csv`

它从当前本地专辑目录预填了 50 张优先核验候选，只是可选维护工具，不是产品发布
前置条件。用户无需为了发布版本手工完成这份工作单。
预填字段来自当前目录，不代表 RYM 已收录这些专辑，也不预判任何匹配结果。

工作单采用 UTF-8 BOM 编码，可直接使用 Windows Excel 打开。保存时应继续保留
UTF-8 CSV 格式，不要改变列名或删除身份字段。

## 不要修改的预填字段

- `priority`
- `neteaseAlbumId`
- `albumSlug`
- `albumTitle`
- `artistNames`
- `releaseYear`
- `releaseType`
- `currentCoreGenres`

这些字段用于将人工核验结果与当前目录进行稳定匹配。多人艺人字段使用英文竖线
`|` 分隔。

## 需要人工填写的字段

### matchStatus

只允许以下五个值：

- `MATCHED`
- `NOT_FOUND`
- `AMBIGUOUS`
- `ACCESS_UNAVAILABLE`
- `REJECTED`

只有确认同一个 RYM 专辑条目后才能填写 `MATCHED`。仅同名不能构成可靠匹配。

### RYM 身份字段

只有 `MATCHED` 可以填写：

- `rymReference`
- `rymDisplayTitle`
- `rymArtistNames`
- `rymReleaseYear`

`rymReference` 必须是实际核验过的专辑条目地址，不能填写搜索结果页、搜索摘要或
推测出来的地址。多个 RYM 艺人名称使用英文竖线 `|` 分隔。

### 分类字段

只有 `MATCHED` 可以填写：

- `primaryGenres`
- `secondaryGenres`
- `descriptors`

分类必须逐项抄录实际 RYM 条目，并保持页面中的原始顺序。多个值统一使用英文
竖线 `|` 分隔，例如：

```text
Art Pop|Synthpop
```

没有 Secondary Genres 或 Descriptors 时直接留空。不能填写：

- `无`
- `N/A`
- `None`
- `unknown`
- `[]`

不得根据当前核心流派、网易云标签、标题、艺人风格、相似专辑或模型判断补齐任何
RYM 分类。

### 核验记录

- `verifiedAt`：使用 `YYYY-MM-DD`。
- `verificationMethod`：人工浏览器核验填写 `MANUAL_BROWSER`。
- `verifiedBy`：可填写 `user`。
- `notes`：记录匹配边界、歧义、版本差异或必要的封面/曲目核对说明；不要复制
  RYM 页面原文。

## 匹配检查清单

填写 `MATCHED` 前至少核对：

1. 专辑标题或可用别名。
2. 艺人名称与完整艺人组合。
3. 发行年份。
4. 发行类型。
5. 必要时对比封面或曲目信息。

以下情况不能填写 `MATCHED`：

- 只有标题相同；
- 艺人组合不一致；
- 年份或发行类型冲突且无法解释；
- 同名候选不止一个；
- 只能看到搜索摘要，无法确认实际专辑条目；
- 页面访问受限，无法完成核对。

应分别使用 `AMBIGUOUS`、`ACCESS_UNAVAILABLE`、`REJECTED` 或 `NOT_FOUND`
记录真实结果。非 `MATCHED` 行必须让所有 RYM 身份与分类字段保持空白。

## 纯示意记录

以下示例完全虚构，不属于当前目录，也不能复制到正式工作单的数据行：

```text
albumTitle:
示例唱片：虚构月光

artistNames:
示例艺人

matchStatus:
MATCHED

rymReference:
https://rateyourmusic.com/release/album/example/example/

primaryGenres:
Art Pop|Synthpop

secondaryGenres:
Dream Pop|Indietronica

descriptors:
melancholic|atmospheric|lush

verifiedAt:
2026-07-23

verificationMethod:
MANUAL_BROWSER

verifiedBy:
user
```

## 交回前自检

1. 所有 `matchStatus` 都是允许值之一。
2. 所有 `MATCHED` 行都完成了标题、艺人、年份和类型核对。
3. 非 `MATCHED` 行没有 RYM URL 或分类内容。
4. 分类使用英文竖线分隔，没有占位文本或空白分类项。
5. 日期符合 `YYYY-MM-DD`。
6. 没有修改预填的网易云 ID、slug、标题、艺人、年份、类型和当前核心流派。
7. 文件继续保存为 UTF-8 CSV。

用户明确提供填写完成的离线文件并要求导入后，后续任务才可执行本地校验、
标准化、专辑匹配、dry-run、幂等导入和冲突报告。本指南本身不授权访问、抓取或
绕过 RYM 的任何访问限制。
