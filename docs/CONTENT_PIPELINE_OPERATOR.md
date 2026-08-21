# Content Pipeline V1 Bulk Operator

Bulk Operator 是 Content Pipeline V1 的本地 Windows 运维入口。PowerShell 只转发参数；Node Operator 负责编排，既有 parser、validator、publisher 与 transaction/recovery core 仍是唯一业务 authority。

## Quick start

```powershell
.\album-import.ps1 doctor
.\album-import.ps1 acquire -Input .\albums.csv
.\album-import.ps1 dry-run -Batch CONTENT-BATCH-YYYYMMDD-NNN
.\album-import.ps1 status -Batch CONTENT-BATCH-YYYYMMDD-NNN
```

`acquire` 的输出会给出 batch ID。只有此命令会主动联网；其他命令只读取本地 payload、封面、候选和 production filesystem。

## 正常工作流

1. 从 `examples/albums-import-template.csv` 复制输入文件。
2. `acquire -Input <file>`：仅按明确的 NetEase Album ID 获取 metadata 与 authoritative cover，保存到 batch；不会自动 dry-run。
3. `dry-run -Batch <id>`：parse、normalize、validate、resolve、duplicate detection、slug、cover derivatives、candidate 和报告；production mutation 为零。
4. `status -Batch <id>`：零写入检查 input/candidate drift、findings 与 transaction 状态。
5. 如果状态为 `NEEDS_REVIEW`，运行 `review -Batch <id>` 导出模板。人类只可接受模板列出的 reviewable finding；ERROR/FATAL/source defect 无法 override。填完后运行 `review -Batch <id> -Apply <decisions.json>`，再重新 dry-run。
6. `prepare -Batch <id>`：在 batch 内创建 PREPARED shadow/ready journal，不写 production。
7. 人类检查 transaction ID、candidate fingerprint 和 write-set，并作单独的 promote 授权。
8. `promote -Batch <id> -Transaction <exact-id> -CandidateFingerprint <exact-sha256>`：精确授权不一致即拒绝。
9. `status -Batch <id>` 验证结果。如 promote 被杀死或机器中断，运行 `recover -Batch <id>`，不要删除 journal。

三个必须停下的人类门是：真实 identity/taxonomy/cover review、PREPARED transaction 检查、实际 promote 授权。

## 输入契约

支持 UTF-8 CSV、TSV、JSON、JSONL/NDJSON（含 BOM、quoted delimiter 和 Unicode）。普通输入只包含 `album_id`、`expected_title`、`expected_artists`、`core_genres`，以及可选 `contexts`、`cover_file`、`source_reference`、`discovered_at`、`manual_verified`、`slug_override`、`refresh`。不要填写内部 Album/Artist ID、tracks、searchText 或 production cover path。

已存在的 NetEase Album ID 会成为 exact duplicate，不会重复导入。source payload 的错误不会被“修好”：例如 Album 18934 的重复 track position 必须保持 `SOURCE_PAYLOAD_DUPLICATE_POSITION / DO_NOT_IMPORT`，不能重排或丢弃 track。

## 命令与退出码

| 命令 | 网络 | 工作区写入 | production 写入 | 显式授权 |
| --- | --- | --- | --- | --- |
| `doctor` | 否 | 否 | 否 | 否 |
| `acquire` | 是 | payload、cover、accounting | 否 | 输入即显式 acquisition scope |
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

Acquisition 默认缓存。`-Refresh` 会单独获取并比较 bytes；任何 payload/cover 变化报告 `SOURCE_REFRESH_DRIFT`，不会静默覆盖已资格化 source。URL 后缀不是 codec authority：decoded PNG 即使来自 `.jpg` URL 仍保存为 `.png`。GET 有 timeout、有限 transient retry 和最大 4 的保守并发。

## 不要这样做

- 不要手改 `src/data/generated` 或手工复制 production covers。
- 不要删除 lock、transaction journal、backup/shadow/ready 来“解除阻塞”。
- 不要用 force 绕过 validator 或 authorization fingerprint。
- 不要修改 frozen release/tag/archive/evidence。
- 不要把 PowerShell execution policy 永久设为 `Unrestricted`；执行权限由用户按组织与 Windows policy 决定，本工具不更改 policy。
