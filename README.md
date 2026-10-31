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

## 收录来源与批量维护

当前 `2026-10-31.3` 快照收录 2,914 个可识别模型 ID，其中 958 条为兼容别名；本次以 OMP 为准对照 910 条同身份记录，新增 8 条独立的 Codex 订阅记录。ID 数量包含供应商限定 ID、日期快照及免费变体，不等于底层独立模型的数量。目录收录不代表供应商仍在服务该模型，也不代表 Kivio 已实现该供应商的专用协议。本次来源、差异和适配边界见 [OMP 对齐记录](OMP-ALIGNMENT-2026-10-31.md)；此前的批量增删见 [10 月 31 日更新记录](REFRESH-2026-10-31.md)。

来源：

- [OMP 模型库](https://github.com/can1357/oh-my-pi/blob/c29f7c56f5530d805bb2887ade964aa55970d8e1/packages/catalog/src/models.json)：此次指定的优先依据。对已匹配的原厂和 OpenRouter 渠道记录，以固定提交的数据覆盖旧资料；原始字段投影与 SHA-256 见 `sources/omp-models-2026-10-31.json`，每项变更见 `OMP-COMPARISON-2026-10-31.json`。API、Codex 订阅和托管渠道的同名模型分别保存，不混用窗口或价格。

- [Models.dev](https://github.com/anomalyco/models.dev)：优先使用模型原厂资料和供应商无关的模型记录；主要推理平台用于补缺，转售商价格不作为裸模型 ID 的统一价格。
- [OpenRouter 全模态目录](https://openrouter.ai/api/v1/models?output_modalities=all)：补充聊天、图像、视频和向量模型；保留 `:free`、`:batch` 等变体的限定 ID。此源只补充非价格资料；发布价格由下述官方价格表统一覆盖。
- [LiteLLM 模型目录](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)：补充开源和向量模型，排除按尺寸/画质计费的配置组合及通用图片编辑操作。
- [Voyage 官方资料](https://www.mongodb.com/docs/voyageai/models/)：核对新向量模型的默认维度和多模态能力；Cohere 的轻量向量模型也用[官方模型表](https://docs.cohere.com/v2/docs/models)核对。补充资料维护在 `sources/verified-models.json`。

Models.dev 和 LiteLLM 的 MIT 许可声明保留在 `licenses/`。每个新增记录带来源；下载快照的 SHA-256 记录在 `_meta.importSnapshot` 和 `IMPORT-REPORT.json` 中。

批量补缺命令（Node.js 20+）：

```sh
node scripts/import-catalogs.mjs --fetch --snapshot-dir /tmp/kivio-catalogs --version 2026-10-14.1
node --test scripts/import-catalogs.test.mjs
node scripts/validate.mjs
```

`--fetch` 将源数据下载到指定目录。省略它可重复使用已经审核的源快照。先审查生成的 JSON 和导入报告，再发布；脚本不会自动推送。导入保留已有记录的资料，但会应用下述清理规则；因此原有条目的非价格修订仍应在 `v1/modelDatabase.json` 中依据原厂资料手动完成。价格单独维护在 `sources/official-pricing.json`，导入最后一步统一应用。未知价格、缺失输出上限和缺失维度保持为空；图片/视频的按张、按秒价格不塞进 token 价格字段。官方补充数据中的 `pricing: null` 表示撤下未能核实的上游报价，生成后的模型记录会省略该字段。

## 旧模型清理规则

导入脚本移除来源标记为 deprecated/retired 的记录、原厂模型已经到达的退役日期，以及 GPT-3.5、早期 GPT-4、Claude 1–3、Gemini 1、Llama 1–2、Gemma 2 等明显过时的系列。相关别名、日期 ID 和免费/批量变体一并清理；依赖被删条目的别名也不会残留。尚未到退役日期的型号不因预告日期被删除。向量模型不单纯按年龄清除。

额外退役核验依据：[OpenAI](https://developers.openai.com/api/docs/deprecations)、[Anthropic](https://platform.claude.com/docs/en/about-claude/model-deprecations)、[Google](https://ai.google.dev/gemini-api/docs/deprecations)。完整移除清单和原因记录在 `IMPORT-REPORT.json` 的 `removedModels`。用户自己配置的供应商、启用模型与覆盖资料不因官方目录清理而删除。

## 2026-10-16 参数核验

本次修正记录见 `VERIFICATION-REPORT.json`，逐条保留官方依据及修改前后的字段。

- Qwen3.8 的原生思考档位为 `low / medium / xhigh`；Flash Next 与 27B 的模板会拒绝 `high`，不能把代理的兼容映射当作模型原生档位。
- DeepSeek 当前 Flash / Pro 原生档位为 `low / high / max`；`xhigh` 是兼容映射，不是另一档更高强度。专用供应商 ID 和未核验变体保留原配置。
- GLM-5.1 不提供原生 effort 旋钮；GLM-5.3 / Flash / FlashX 不允许关闭思考。
- 官方 GPT-5.5、GPT-5.6（Cyber 除外）和已核验 GPT-6 型号的上下文为 1,050,000，最大输出为 128,000；GPT-5.6 Cyber 上下文为 400,000。GPT-5.5 Pro 的档位为 `medium / high / xhigh`。

模型原生能力与供应商兼容参数不是同一件事。仅对有明确身份关系的别名传播已核验字段；保留供应商专用路由、免费变体的独立限制和报价。用户覆盖仍优先。Qwen 开源模型的关闭思考需要供应商正确处理 `enable_thinking` / `chat_template_kwargs`；本次不把它们的 `thinkingOff` 从未知改成已支持。


## 2026-10-16 价格核验

`2026-10-16.2` 对全部 2,756 个 ID 应用官方报价规则，757 条取得可溯源报价（665 条文本 token 价格，92 条按图片、时长或分模态计费资料，数量含别名）。撤下 680 条未经原厂确认的旧报价，包括转售商价格、免费额度、开源模型的零值占位和单位混用。缺失代表未知，不代表免费。逐项修改前后及来源见 `PRICING-VERIFICATION-REPORT.json`。

- 发布价格的唯一维护入口是 `sources/official-pricing.json`。每条记录保留来源链接、原币种、适用地域、计费条件；`pricingSource` 同步写入发布快照。OMP 对齐条目标为 `kind: "catalog"`，按本次指定的优先级覆盖旧报价；其余条目继续使用原厂依据，其他批量目录不能覆盖参考报价。
- `pricing` 仍为 USD／百万文本 token 的基础参考价。上下文阶梯、思考/非思考差异放入 `pricingTiers`；图像、音频 token 单独放入 `modalityPricing`，按张/秒/字符等计费放入 `unitPricing`。现有客户端只消费 `pricing`，不把其他单位误作文本 token，也未实现按条件自动切换所有价格阶梯。
- 原厂有明确美元价时采用美元价（例如小米海外 API）；仅人民币报价按 **2026-10-16 的 1 USD = 6.722 CNY** 固定换算。来源为[中国外汇交易中心授权公布的当日汇率中间价](https://www.xinhuanet.com/20261016/7095dae31ecc47eeb2ea7679834be269/c.html)。原始人民币金额与汇率日期保留，导入时不联网浮动换汇。Qwen 采用北京地域价格，腾讯混元采用广州地域价格。
- 官方免费模型必须有直接的零价依据；第三方 `free` 路由不自动继承原厂付费价或被当作原厂免费。相同身份的供应商限定 ID 使用原厂参考价，不代表该供应商的实际账单。
- 当前促销价保留在参考价中，期限和长期价格写在条件说明。长期会变的价格仍需定期核验；本次快照不会随汇率或促销日期自行变化。

仅更新已核验价格，无需重新下载第三方目录：

```sh
node scripts/import-catalogs.mjs --pricing-only --version 2026-10-16.3
node --test scripts/import-catalogs.test.mjs
node scripts/validate.mjs
```

验证器会按官方价格表重新计算并比对所有价格字段、来源和固定汇率，阻止手改发布快照或导入旧报价造成的偏差。发布仍需递增版本。用户自己的价格覆盖继续优先，按上下文、缓存写入、工具调用、地域和第三方渠道产生的实际费用应以供应商账单为准。

2026-10-31.3：仅修正近期 OpenAI 型号及已确认别名的 `contextWindow`。Codex 当前目录确认 GPT-6.1 Terra / Sol 为 500K，GPT-6 Astra / Sol / Luna 与 GPT-5.6 Sol / Terra / Luna 为 272K。目录刷新时间与窗口原值见 `sources/codex-models-2026-10-31.json`；其他参数保持上一版。
