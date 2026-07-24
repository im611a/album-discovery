# 发布管线

## 完整命令

在已提交且工作区干净的交付分支运行：

```text
pnpm release:prepare
```

命令依次执行目录校验、lint、类型检查、完整测试、生产构建、最新 `out` 的本地静态 HTTP 路由检查、源码包与静态包临时生成、解压与内容验证、SHA-256 计算和结构化摘要输出。任一步失败返回非零。

## 失败保护

临时包位于被忽略的 `artifacts/.release-*`。旧根目录 ZIP 在所有检查通过前不会删除；替换时先改名为 `.previous`，新包就位后才删除备份。失败时不把临时文件冒充交付包，也不操作提交、远程、stash 或 tag。

内部 `out/release-manifest.json` 记录当前分支、短提交、目录统计、专题与索引版本及索引内容哈希，不记录静态 ZIP 自身哈希以避免自引用。ZIP 的 SHA-256 写入外部 `album-discovery-delivery.json`。

## 查看与核验

```text
pnpm serve:static
pnpm delivery:verify
```

浏览 `http://127.0.0.1:4173/`。不要复用旧解压目录；应解压到新目录并检查其中 `release-manifest.json` 的 `commit`。交付验证会拒绝 commit 与 HEAD 不一致的旧包，并核对专辑、艺人和专题页面。

若发布失败，根目录最后一份有效 ZIP 保持可用；确认失败原因后重新构建，不要从旧 `artifacts` 复制包伪装成新版本。
