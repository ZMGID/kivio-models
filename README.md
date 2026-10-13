# kivio-models

Kivio 的公开模型资料库。模型名称、上下文长度、最大输出、能力、思考档位和参考价格可独立于应用版本更新。

## 更新模型库

1. 修改 `v1/modelDatabase.json` 中对应模型的资料，尽量在 `_meta.sources` 记录官方依据。
2. 将 `_meta.version` 升到新的 `YYYY-MM-DD.N` 版本，例如 `2026-10-13.2`；同一天递增最后一段数字。已发布内容发生变化必须升版。
3. 使用 Node.js 20 或更新版本运行 `node scripts/validate.mjs`，通过 PR 的 Validate 检查后合并到 `main`。
4. 合并即发布。Kivio 用户在「设置 → 关于 → 检查更新」点击「更新模型库」即可下载；不需要发布 Kivio 安装包。

固定通道地址：

https://raw.githubusercontent.com/ZMGID/kivio-models/main/v1/modelDatabase.json

Kivio 发版流程会先固定模型库提交 SHA，再把同一份经过校验的快照打包进 macOS 和 Windows。应用首次安装、离线启动均有内置数据。

## 数据契约

- `_meta.schemaVersion` 为 `1`。不兼容的格式应新增通道（如 `v2/`），不能破坏 `v1/`；旧客户端继续读取 v1。
- 模型 ID 为小写键；保留原有 ID 的语义，避免把不同版本当作同一模型。
- `contextWindow`、`maxOutput`、`dimensions` 为非负整数；部分非文本模型的上下文可为 0。
- `pricing` 中价格为每百万 token 的参考价格，单位 USD；不代表第三方代理的实际收费。
- `capabilities` 是布尔字段；`reasoningEfforts` 是资料中的档位列表。应用仅使用自身支持的档位，新协议或新能力仍需要更新应用。
- 官方快照整体替换旧官方快照，删除的模型不因旧数据合并而复活。
- 用户在 Kivio 内的模型自定义设置优先；历史本地 `modelDatabase.json` 覆盖文件也保留。官方缓存另存为 `modelDatabase.official.v1.json`。

## 回滚

将正确的旧资料恢复到一个**更高版本号**后发布。客户端不会自动降级模型库，直接把分支回退到低版本不能让已更新用户回滚。

数据沿用 Kivio 的 GPL-3.0-or-later 许可，见 LICENSE。
