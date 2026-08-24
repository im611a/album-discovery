# Content Pipeline V1 Bulk Operator

Bulk Operator 是 Content Pipeline V1 的本地 Windows 运维入口。PowerShell 只转发参数；Node Operator 负责编排，既有 parser、validator、publisher 与 transaction/recovery core 仍是唯一业务 authority。

## Quick start

```powershell
.\album-import.ps1 doctor
.\album-import.ps1 discover -Limit 1000
.\album-import.ps1 acquire -Input .\albums.csv
.\album-import.ps1 finalize-acquisition -Batch CONTENT-BATCH-YYYYMMDD-NNN
.\album-import.ps1 taxonomy -Batch CONTENT-BATCH-YYYYMMDD-NNN
.\album-import.ps1 dry-run -Batch CONTENT-BATCH-YYYYMMDD-NNN
.\album-import.ps1 status -Batch CONTENT-BATCH-YYYYMMDD-NNN
```

`discover` 输出可直接交给 `acquire` 的 candidate path；`acquire` 输出 batch ID。只有这两个命令会主动联网，其他命令只读取本地 payload、封面、候选和 production filesystem。

## Discovery Gateway V1

```powershell
.\album-import.ps1 discover
.\album-import.ps1 discover -Limit 1000
.\album-import.ps1 acquire -Input "<discover 输出的 candidate path>"
```

默认 source 是当前 production Artist 的完整公开 discography，加上 `area=ALL` 的公开新专辑列表；`-FromCurrentArtists` 可把一次 run 限制为当前 Artist universe，`-ArtistLimit` 用于保守 smoke，`-Types` 可从 `album,ep,single,compilation,live,soundtrack,other` 中明确选择。默认输出类型是 `album,ep`，但 snapshot 仍保留其他 source-metadata 类型的统计，绝不按标题猜类型。`-Limit` 限制最终 NEW candidate rows，不限制 HTTP response 数量。

每次 run 写入 `.local-data/content-pipeline-v1/discovery/runs/DISCOVERY-RUN-*/`，包括 `snapshot.json` 和 `discovered-albums.json`。同一 source/page 默认复用哈希校验缓存；`-Refresh` 才重新请求并报告 `DISCOVERY_SOURCE_DRIFT`。Snapshot 记录 source、请求页、失败、production SHA、existing/new 分类和 fingerprint。它是公开 source candidate enumeration，不是网易云内部完整数据库。

Discovery 生成的标题/艺人 assertion 来自公开 source，`manual_verified=false`。本站 `core_genres` 不由网易 tags、标题、脚本或模型推断，因此 candidate 中保持空值。`acquire` 可以直接获取 payload/cover；进入 qualified candidate 前，仍必须由人类或另行获准的批量 taxonomy decision 填入现有 core genre key。旧 discovery artifact 的 production SHA 与当前 catalog 不一致时，Operator fail closed 并要求重新 discovery/dedupe。

## 正常工作流

1. 运行 `discover` 自动枚举候选，或从 `examples/albums-import-template.csv` 复制人工输入文件。
2. `acquire -Input <file>`：仅按明确的 NetEase Album ID 获取 metadata 与 authoritative cover，保存到 batch；不会自动 dry-run。
3. acquisition 有少量确定性坏记录时，`finalize-acquisition -Batch <id>` 读取原 report，将 validator 已标记 `DO_NOT_IMPORT` 的记录与 unavailable failure 隔离，生成完整 1:1 accounting 和 clean derived input。它逐一核对原 payload/cover SHA，只引用原文件，不复制、不重新下载、不修改原 report。
4. discovery input 缺少 taxonomy 时，`taxonomy -Batch <id>` 使用 production 中相同 NetEase Artist ID 的已审阅 core genre evidence，输出 `HIGH_CONFIDENCE`、`AMBIGUOUS`、`NO_EVIDENCE` 分组及 review template。所有建议均为 `PROPOSED`，包括 HIGH_CONFIDENCE；不会自动成为 human acceptance。
5. 人类可编辑 taxonomy template，并用 `review -Batch <id> -Apply <taxonomy-decisions.json>` 接受一个或多个明确 group。未知 key、外部 group、`accept-all` 和 PENDING 都不能越过门；全部 group 明确决定后才生成 taxonomy-reviewed derived input。
6. `dry-run -Batch <id>` 执行原有 qualification。存在 finalized acquisition 时，未完成全部 taxonomy group review 会 fail closed。进入最终 catalog validator 前，Operator 使用 validator 的同一 canonical artist/title/year identity 构建 production↔candidate 与 candidate↔candidate 冲突组；冲突成员进入正式 `CANDIDATE_IDENTITY_CONFLICT` review。Review 的 `ACCEPT` 保留候选，`REJECT` 将整行记为 `REJECTED_BY_REVIEW` 并保留原 finding；接受后仍冲突的选择会被 hard invariant 标为 FATAL。排除冲突后的 clean candidate 仍执行完整 catalog validation，局部冲突不会向无关行广播 FATAL，catalog 唯一性规则也不会放宽。
7. `status -Batch <id>` 零写入显示 requested/clean/quarantine/unavailable、taxonomy group 和 qualification/transaction 状态。
8. qualification finding review、prepare、promote 和 recover 继续使用原有 authority，未改变授权边界。

正式 review artifact 的 `decisions` 只接受 `ACCEPT` 或 `REJECT`；`PENDING` 始终阻断。`ERROR`、`FATAL` 与 acquisition source defect 不能借 REJECT override。Artifact 另有独立 `quarantines` 段，目前唯一白名单是确定性的 `invalid_track_list → QUARANTINE`：它把该行记为 `QUARANTINED`，在 report 中内嵌保留完整原 ERROR，并保留已有 payload/cover bytes；任何未知 ERROR 继续阻断。`READY + REJECTED_BY_REVIEW + QUARANTINED + NEEDS_REVIEW + ERROR + FATAL + SKIPPED_DUPLICATE + IMPORTED` 必须精确等于输入行数，否则 prepare fail closed。

三个必须停下的人类门是：真实 identity/taxonomy/cover review、PREPARED transaction 检查、实际 promote 授权。

## 输入契约

支持 UTF-8 CSV、TSV、JSON、JSONL/NDJSON（含 BOM、quoted delimiter 和 Unicode）。普通输入只包含 `album_id`、`expected_title`、`expected_artists`、`core_genres`，以及可选 `contexts`、`cover_file`、`source_reference`、`discovered_at`、`manual_verified`、`slug_override`、`refresh`。不要填写内部 Album/Artist ID、tracks、searchText 或 production cover path。

已存在的 NetEase Album ID 会成为 exact duplicate，不会重复导入。source payload 的错误不会被“修好”：例如 Album 18934 的重复 track position 必须保持 `SOURCE_PAYLOAD_DUPLICATE_POSITION / DO_NOT_IMPORT`，不能重排或丢弃 track。

## 命令与退出码

| 命令 | 网络 | 工作区写入 | production 写入 | 显式授权 |
| --- | --- | --- | --- | --- |
| `doctor` | 否 | 否 | 否 | 否 |
| `discover` | 是 | cache、snapshot、candidate input | 否 | public enumeration scope |
| `acquire` | 是 | payload、cover、accounting | 否 | 输入即显式 acquisition scope |
| `finalize-acquisition` | 否 | quarantine report、clean input view | 否 | 否；只执行 validator disposition |
| `taxonomy` | 否 | proposal、grouped review template | 否 | 否；建议不自动接受 |
| `dry-run` | 否 | candidate/report | 否 | 否 |
| `status` | 否 | 否 | 否 | 否 |
| `review` | 否 | template/decision overlay | 否 | 人工 decision |
| `prepare` | 否 | transaction shadow/ready | 否 | 否；完成后必须停 |
| `promote` | 否 | journal | 是 | exact transaction + candidate SHA |
| `recover` | 否 | journal/rollback | 仅恢复 journal 所述状态 | exact batch |
| `help` | 否 | 否 | 否 | 否 |

退出码：`0` command 成功；`2` usage；`3` input；`4` acquisition；`5` review required；`6` preflight blocked；`7` authorization required/mismatch；`8` transaction/recovery；`9` unexpected internal error。

`-Json` 对应 `--json`，stdout 恰好为一个 JSON envelope，诊断写 stderr：

```powershell
.\album-import.ps1 status -Batch CONTENT-BATCH-YYYYMMDD-NNN -Json
```

## 并发、缓存和恢复

每个 batch 有原子 local writer lock；prepare/promote/recover 另有 production global lock。活 PID 的第二 writer 会被拒绝。死 PID 只有在无 non-terminal transaction 时才可回收 stale lock；否则返回 `RECOVERY_REQUIRED`。不同 batch 的 read-only/status 不需要 global lock。

Discovery 与 Acquisition 都默认缓存。Discovery 对同一 source/page 保存 response SHA，并以有限 pagination guard 防止无限循环；单 Artist 失败被隔离，401/403/持续 429 会停止继续扩大对应 source，不会规避访问限制。`-Refresh` 会显式重新获取并报告 source drift，旧 run snapshot 不覆盖。Acquisition refresh 的任何 payload/cover 变化报告 `SOURCE_REFRESH_DRIFT`，不会静默覆盖已资格化 source。URL 后缀不是 codec authority：decoded PNG 即使来自 `.jpg` URL 仍保存为 `.png`。GET 有 timeout、有限 transient retry 和最大 4 的保守并发。

## 不要这样做

- 不要手改 `src/data/generated` 或手工复制 production covers。
- 不要删除 lock、transaction journal、backup/shadow/ready 来“解除阻塞”。
- 不要用 force 绕过 validator 或 authorization fingerprint。
- 不要删除坏行来伪造 clean batch；所有 requested records 必须保留 quarantine accounting。
- 不要把 HIGH_CONFIDENCE proposal 当作 human accepted，也不要对 unknown groups 执行 accept-all。
- 不要修改 frozen release/tag/archive/evidence。
- 不要把 PowerShell execution policy 永久设为 `Unrestricted`；执行权限由用户按组织与 Windows policy 决定，本工具不更改 policy。
