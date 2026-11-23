# GPT 聊天模型的默认上下文

`2026-11-24.2` 按 Codex 对齐 GPT 聊天模型的默认上下文。核对 191 个模型 ID，更新 109 个。其中 4 个 GPT‑OSS 渠道的最大输出原先为 131,072，同时下调至新窗口的 128,000。实际费率和模型 ID 沿用既有资料。

- 采用 Codex 的 `context_window`。GPT‑6.2 Astra 为 272,000，GPT‑6.2 Sol 和 GPT‑6.1 Sol、Terra 为 500,000。Codex 将可选最大窗口与运行时预留分别登记。 [Codex 0.171.0 模型目录](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/models-manager/models.json)
- 日期快照、批量渠道、同底模 Pro 和 Fast 条目采用对应型号的默认窗口。按本次各家族最新版设置 OpenRouter 的浮动别名。 [OpenRouter OpenAI 目录](https://openrouter.ai/openai/)
- 当前目录已下架的 GPT 型号使用 Codex 历史目录中的窗口。Codex 未单列的 GPT 聊天型号采用 272,000 回退上限。渠道已知窗口更小时采用较小值。 [Codex 0.139.0 模型目录](https://github.com/openai/codex/blob/rust-v0.139.0/codex-rs/models-manager/models.json) · [Codex 0.120.0 模型目录](https://github.com/openai/codex/blob/rust-v0.120.0/codex-rs/models-manager/models.json) · [Codex 回退规则](https://github.com/openai/codex/blob/rust-v0.171.0/codex-rs/models-manager/src/model_info.rs)
- 图像生成、语音和实时模型沿用各自数据。Kivio 的模型自定义窗口优先于目录默认值。

[Codex 参数记录](sources/codex-models-2026-11-24.json)保存本次使用的型号、窗口与别名对应。更新 GPT 聊天资料时，先核对 Codex 的当前目录，再检查渠道限制及最大输出。
