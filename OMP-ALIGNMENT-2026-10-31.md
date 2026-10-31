# OMP model-data alignment — 2026-10-31

Version `2026-10-31.2` uses the requested OMP baseline for 910 matched model IDs, including identity aliases and existing OpenRouter routes. Eight independent Codex subscription IDs are added; total catalog size is 2,914. Existing provider selections and user overrides remain untouched. Unmatched models and the prior retirement policy are retained.

## Frozen source

- Repository commit: [`can1357/oh-my-pi@c29f7c56f5530d805bb2887ade964aa55970d8e1`](https://github.com/can1357/oh-my-pi/commit/c29f7c56f5530d805bb2887ade964aa55970d8e1).
- [Generated model catalog](https://github.com/can1357/oh-my-pi/blob/c29f7c56f5530d805bb2887ade964aa55970d8e1/packages/catalog/src/models.json), SHA-256 `77fee8019a5a10b425b081d81240912ef325c3a0121e0a4d5e1811628013340c`.
- The source's own compact-catalog decoder was used; a full encode/decode round trip matched every provider. The generated snapshot is the chosen baseline, even where authoring KDL or previously checked vendor pages disagree.
- `sources/omp-models-2026-10-31.json` retains the source fields used for comparison. `OMP-COMPARISON-2026-10-31.json` records before/after entries, source IDs and fields that need additional transport translation. OMP's MIT notice is retained in `licenses/oh-my-pi-MIT.txt`.

## Recent OpenAI models

| Source route | Context window | Max output | Efforts |
| --- | ---: | ---: | --- |
| OpenAI GPT-5.4 | 1,000,000 | 128,000 | low / medium / high / xhigh |
| OpenAI GPT-5.4 Mini / Nano | 400,000 | 128,000 | low / medium / high / xhigh |
| OpenAI GPT-5.4 Pro / GPT-5.5 / GPT-5.5 Pro | 1,050,000 | 128,000 | low / medium / high / xhigh |
| OpenAI GPT-5.6 family | 1,050,000 | 128,000 | low / medium / high / xhigh / max |
| OpenAI GPT-6 Astra / Sol / Luna / GPT-6.1 Sol / Terra | 1,050,000 | 128,000 | low / medium / high / xhigh / max |
| Codex GPT-5.6 Sol / Terra / Luna | 1,000,000 | 128,000 | low / medium / high / xhigh / max |
| Codex GPT-6 Astra / Sol / Luna | 272,000 | 128,000 | low / medium / high / xhigh / max |
| Codex GPT-6.1 Sol | 500,000 | 128,000 | low / medium / high / xhigh / max |

Cyber remains 400,000. The bundled OMP Codex records carry a separate 872,000 maximum-context field; it is preserved as metadata, not substituted for the default or used to clamp user overrides. The source contains no bundled Codex Terra row yet, so none is invented. Codex GPT Image 2 uses a specialized image workflow and is not added as an ordinary chat model.

OMP's API standard reference prices for Astra / 6.1 Sol / 6.1 Terra / Luna remain respectively 10/50/1, 2/10/0.1, 1/5/0.05 and 0.1/0.5/0.01 USD per million input/output/cached-input tokens. Source-specific long-context cards are retained; absent cards are not filled from another route. Cache writes, dated cards and peak/off-peak schedules remain in `catalogCost`; existing clients do not automatically implement all those billing rules. Subscription figures are API-equivalent references, not a per-token Codex invoice.

`lowest-effort` is not a real thinking-off mode: the catalog no longer claims that those OpenAI rows support disabling reasoning. GPT-5.6 rows with `none-effort` retain actual Off support. OMP's Pro virtual IDs with a different `requestModelId` are listed in the report, not added as new direct OpenAI endpoints; routing the Pro mode needs separate application support.

## Matching and adaptation boundaries

Native rows update existing bare IDs and their identified aliases. Exact OMP OpenRouter IDs win for that serving route; they do not overwrite the bare original model. This deliberately preserves differences such as Gemini Argon's native 32,768 output budget versus the OpenRouter row's 943,718. Model names already curated for Kivio display are retained.

Context/output limits, transferable effort values, image/reasoning/tool capability flags and route reference prices are projected into the existing v1 fields. Budget presets, custom effort maps, missing native disable semantics and unsupported effort enum values are not silently treated as equivalent wire parameters. OMP's original thinking metadata remains available in each matched record and the comparison source. An absent video modality in OMP's text/image interface does not erase Kivio's independently supported native video transport.

All-zero OMP rate cards remain unknown unless explicitly marked free; unknown is not free. The existing price registry remains the single publishing owner, with these selected source records marked `kind: "catalog"` rather than mislabeled official. Subsequent pricing-only regeneration preserves the OMP overrides. Other currencies retain the prior fixed conversion.

Kivio's existing provider-aware metadata lookup now selects `openai-codex/…` for known Codex OAuth records in both frontend and backend, keeping model IDs sent on the wire and per-model user overrides unchanged. Unlisted/private IDs keep the existing fallback. Already-installed clients receive the shared model-data changes immediately; automatic selection of Codex-specific defaults needs the updated application code.

No new inference transport, automatic extended-context switch, billing engine, or paid/live inference test is included.
