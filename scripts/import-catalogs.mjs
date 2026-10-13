import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FEEDS = {
  'models-dev-canonical': 'https://models.dev/models.json',
  'models-dev': 'https://models.dev/api.json',
  'openrouter-all': 'https://openrouter.ai/api/v1/models?output_modalities=all',
  litellm: 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
}
const LABS = ['openai', 'anthropic', 'google', 'alibaba', 'cohere', 'mistral', 'meta', 'zai', 'zhipuai', 'moonshotai', 'minimax', 'xiaomi', 'xai', 'stepfun', 'volcengine', 'inception', 'ai21', 'upstage', 'perplexity', 'bailing', 'longcat', 'sakana', 'thinkingmachines', 'alibaba-cn']
const HOSTS = ['llama', 'deepinfra', 'togetherai', 'fireworks-ai', 'nvidia', 'groq', 'cerebras', 'huggingface', 'nebius', 'novita-ai', 'siliconflow', 'siliconflow-cn', 'ollama-cloud', 'amazon-bedrock']
const LITELLM_PROVIDERS = ['openai', 'anthropic', 'gemini', 'mistral', 'cohere', 'cohere_chat', 'voyage', 'deepseek', 'dashscope', 'zai', 'xai', 'moonshot', 'minimax', 'vertex_ai-video-models', 'black_forest_labs', 'stability', 'runwayml', 'ollama', 'together_ai', 'deepinfra', 'fireworks_ai', 'novita', 'nvidia_nim', 'ai21', 'tencent', 'xiaomi_mimo', 'inception', 'codestral']
const MODES = new Set(['chat', 'responses', 'completion', 'embedding', 'image_generation', 'image_edit', 'video_generation'])
const EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
const integer = n => Number.isInteger(n) && n >= 0 && n <= 4294967295
const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0
const normalized = id => id.toLowerCase().replaceAll('.', '-')
const tail = id => id.split('/').at(-1)
const clone = value => structuredClone(value)
const IMAGE_OPERATIONS = new Set(['conservative', 'creative', 'erase', 'fast', 'inpaint', 'outpaint', 'remove-background', 'replace-background-and-relight', 'search-and-recolor', 'search-and-replace', 'sketch', 'structure', 'style', 'style-transfer'])
const cleanId = id => typeof id === 'string' && id.trim() && !/^(?:arn:|us\.|eu\.|apac\.|global\.)/i.test(id) && !/(?:^|\/)\d+-x-\d+(?:\/|$)/.test(id) && !/^(?:\d+-steps|max-steps)\//.test(id) && !IMAGE_OPERATIONS.has(id.toLowerCase())

function facts(model, url, provider) {
  const inputs = model.modalities?.input ?? []
  const outputs = model.modalities?.output ?? []
  const mode = model.type ?? (outputs.includes('image') ? 'image_generation' : outputs.includes('video') ? 'video_generation' : 'chat')
  if (!MODES.has(mode) || (mode !== 'embedding' && !outputs.some(v => ['text', 'image', 'video'].includes(v)))) return null
  const context = model.limit?.context
  if (!integer(context) || (mode === 'chat' && context === 0)) return null
  const capabilities = {}
  if (Array.isArray(model.modalities?.input)) {
    capabilities.vision = inputs.includes('image')
    capabilities.videoInput = inputs.includes('video')
    capabilities.audioInput = inputs.includes('audio')
  }
  for (const [field, value] of Object.entries({ functionCalling: model.tool_call, reasoning: model.reasoning, structuredOutput: model.structured_output })) {
    if (typeof value === 'boolean') capabilities[field] = value
  }
  if (outputs.includes('image')) capabilities.imageGeneration = true
  if (outputs.includes('video')) capabilities.videoGeneration = true
  if (outputs.includes('audio')) capabilities.audioOutput = true
  if (mode === 'embedding') capabilities.embedding = true
  const entry = { displayName: model.name ?? model.id, contextWindow: context, capabilities, modelType: mode, source: { catalog: 'models.dev', url, ...(provider ? { provider } : {}) } }
  if (integer(model.limit?.output) && model.limit.output > 0 && model.limit.output <= context && mode === 'chat') entry.maxOutput = model.limit.output
  if (model.modalities) entry.modalities = clone(model.modalities)
  if (model.release_date) entry.releaseDate = model.release_date
  if (model.status) entry.status = model.status
  if (model.canonical_model_id) entry.canonicalId = model.canonical_model_id.toLowerCase()
  const effort = model.reasoning_options?.find(option => option.type === 'effort' && Array.isArray(option.values))
  if (effort) entry.reasoningEfforts = [...new Set(effort.values.filter(level => EFFORTS.has(level)))]
  else if (model.reasoning === false) entry.reasoningEfforts = []
  return entry
}

function prices(values, factor) {
  const result = {}
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined || raw === null || raw === '') continue
    const n = typeof raw === 'string' ? Number(raw) : raw
    if (number(n)) result[key] = Number((n * factor).toPrecision(12))
  }
  return Object.keys(result).length ? result : undefined
}

/** Preserve curated entries; add real API IDs, then add only unambiguous compatibility aliases. */
export function buildCatalog(previous, feeds, version) {
  const database = clone(previous)
  const report = { previousEntries: Object.keys(previous).length - 1, addedBySource: {}, excludedBySource: {}, aliases: 0, preservedEntries: Object.keys(previous).length - 1 }
  const byNormalized = new Map(Object.keys(previous).filter(id => id !== '_meta').map(id => [normalized(id), id]))
  const aliases = new Map()
  const curatedReference = (id, entry) => {
    const candidates = [id, tail(id), entry?.canonicalId, entry?.canonicalId && tail(entry.canonicalId)].filter(Boolean)
    for (const candidate of candidates) {
      const base = candidate.replace(/:(free|batch)$/, '').replace(/-\d{6,8}$/, '').replace(/-(low|medium|high|xhigh|max)$/, '')
      const found = byNormalized.get(normalized(candidate)) ?? byNormalized.get(normalized(base))
      if (found) return found
    }
    return null
  }
  const add = (id, entry, source, allowBare = false) => {
    if (!cleanId(id) || !entry) { report.excludedBySource[source] = (report.excludedBySource[source] ?? 0) + 1; return }
    id = id.toLowerCase()
    if (id === '_meta' || id in database) return
    // Existing curated dot/dash spelling must retain the same metadata after expansion.
    const curated = curatedReference(id, entry)
    if (curated) {
      const variant = /:(free|batch)$/.test(id)
      const original = clone(previous[curated])
      database[id] = { ...entry, ...original, source: { ...entry.source, curatedBase: curated }, ...(variant ? { variantOf: curated } : { aliasOf: curated }) }
      if (variant) {
        database[id].contextWindow = entry.contextWindow
        database[id].capabilities = { ...original.capabilities, ...entry.capabilities }
        if (entry.pricing) database[id].pricing = entry.pricing
        else delete database[id].pricing
        if (entry.maxOutput) database[id].maxOutput = entry.maxOutput
      }
    } else database[id] = entry
    report.addedBySource[source] = (report.addedBySource[source] ?? 0) + 1
    if (allowBare && id.includes('/') && !id.includes(':')) {
      const name = tail(id)
      if (!aliases.has(name)) aliases.set(name, new Set())
      aliases.get(name).add(id)
    }
  }
  // First-party serving data has precedence for unqualified API IDs and reference pricing.
  for (const provider of LABS) {
    for (const [id, model] of Object.entries(feeds['models-dev'][provider]?.models ?? {})) {
      const entry = facts(model, FEEDS['models-dev'], provider)
      if (!entry) { add(id, null, 'models.dev:first-party'); continue }
      if (provider !== 'alibaba-cn') {
        const pricing = prices({ input: model.cost?.input, output: model.cost?.output, cachedInput: model.cost?.cache_read }, 1)
        if (pricing && (entry.modelType === 'chat' || entry.modelType === 'embedding')) entry.pricing = pricing
      }
      add(id, entry, 'models.dev:first-party', true)
    }
  }
  // Provider-agnostic model facts avoid assigning one reseller's token limits/prices to every route.
  for (const [id, model] of Object.entries(feeds['models-dev-canonical'])) {
    const entry = facts(model, FEEDS['models-dev-canonical'])
    if (entry) entry.canonicalId = id.toLowerCase()
    add(id, entry, 'models.dev:canonical', true)
  }
  // Keep OpenRouter variants (:free, :extended) qualified; no guessed naked aliases for these.
  for (const model of feeds['openrouter-all'].data) {
    const inputs = model.architecture?.input_modalities ?? []
    const outputs = model.architecture?.output_modalities ?? []
    if (!outputs.some(mode => ['text', 'image', 'video', 'embeddings'].includes(mode))) continue
    const mode = outputs.includes('embeddings') ? 'embedding' : outputs.includes('image') ? 'image_generation' : outputs.includes('video') ? 'video_generation' : 'chat'
    const context = model.context_length
    if (!integer(context) || (mode === 'chat' && context === 0)) { add(model.id, null, 'openrouter'); continue }
    const parameters = model.supported_parameters ?? []
    const capabilities = { vision: inputs.includes('image'), videoInput: inputs.includes('video'), audioInput: inputs.includes('audio'), functionCalling: parameters.includes('tools'), reasoning: parameters.includes('reasoning') || parameters.includes('reasoning_effort'), structuredOutput: parameters.includes('structured_outputs') }
    if (outputs.includes('image')) capabilities.imageGeneration = true
    if (outputs.includes('video')) capabilities.videoGeneration = true
    if (mode === 'embedding') capabilities.embedding = true
    if (outputs.includes('audio')) capabilities.audioOutput = true
    const entry = { displayName: model.name, contextWindow: context, capabilities, modelType: mode, modalities: { input: inputs, output: outputs }, source: { catalog: 'OpenRouter', url: FEEDS['openrouter-all'], provider: 'openrouter' } }
    if (integer(model.top_provider?.max_completion_tokens) && model.top_provider.max_completion_tokens > 0 && model.top_provider.max_completion_tokens <= context && mode === 'chat') entry.maxOutput = model.top_provider.max_completion_tokens
    // Never label per-image or per-second billing as free tokens.
    const pricing = prices({ input: model.pricing?.prompt, output: model.pricing?.completion, cachedInput: model.pricing?.input_cache_read }, 1_000_000)
    if (pricing && (mode === 'chat' || mode === 'embedding' || Object.values(pricing).some(n => n > 0))) entry.pricing = pricing
    if (Array.isArray(model.reasoning?.supported_efforts)) entry.reasoningEfforts = model.reasoning.supported_efforts.filter(e => EFFORTS.has(e))
    else if (!capabilities.reasoning) entry.reasoningEfforts = []
    const existing = database[model.id.toLowerCase()]
    // Enrich newly imported canonical IDs, never change curated entries from the previous version.
    if (existing && !previous[model.id.toLowerCase()] && !existing.aliasOf) {
      if (!existing.pricing && entry.pricing) {
        existing.pricing = entry.pricing
        existing.pricingSource = { provider: 'openrouter', url: FEEDS['openrouter-all'] }
      }
    }
    add(model.id, entry, 'openrouter')
  }
  for (const provider of HOSTS) {
    for (const [id, model] of Object.entries(feeds['models-dev'][provider]?.models ?? {})) {
      add(id, facts(model, FEEDS['models-dev'], provider), 'models.dev:hosted', true)
    }
  }
  for (const [key, model] of Object.entries(feeds.litellm)) {
    const provider = model.litellm_provider
    if (!LITELLM_PROVIDERS.includes(provider) || !MODES.has(model.mode)) continue
    let id = key
    const prefix = key.split('/')[0]
    // LiteLLM adapter prefixes are not the API model ID. Keep actual account/model paths intact.
    if ([provider, 'gemini', 'vertex_ai', 'cohere', 'voyage', 'mistral', 'dashscope', 'ollama', 'together_ai', 'together-ai', 'deepinfra', 'fireworks_ai', 'novita', 'nvidia_nim', 'black_forest_labs', 'stability', 'runwayml', 'minimax', 'moonshot', 'zai', 'xai', 'ai21', 'tencent', 'xiaomi_mimo', 'inception', 'codestral'].includes(prefix)) id = key.slice(prefix.length + 1)
    if (!cleanId(id) || ['stability'].includes(provider) && IMAGE_OPERATIONS.has(tail(id).toLowerCase())) continue
    const media = ['image_generation', 'image_edit', 'video_generation'].includes(model.mode)
    const context = media ? 0 : model.max_input_tokens
    // Missing token limits stay unimported for text/embedding; max_tokens is ambiguous legacy data.
    if (!integer(context) || (!media && context === 0)) { add(id, null, 'litellm'); continue }
    const capabilities = {}
    for (const [field, value] of Object.entries({ vision: model.supports_vision, functionCalling: model.supports_function_calling, reasoning: model.supports_reasoning, audioInput: model.supports_audio_input, audioOutput: model.supports_audio_output, webSearch: model.supports_web_search })) if (typeof value === 'boolean') capabilities[field] = value
    if (model.mode === 'embedding') capabilities.embedding = true
    if (['image_generation', 'image_edit'].includes(model.mode)) capabilities.imageGeneration = true
    if (model.mode === 'video_generation') capabilities.videoGeneration = true
    const entry = { displayName: id, contextWindow: context, capabilities, modelType: model.mode, source: { catalog: 'LiteLLM', url: FEEDS.litellm, provider, sourceId: key } }
    if (!media && model.mode !== 'embedding' && integer(model.max_output_tokens) && model.max_output_tokens > 0 && model.max_output_tokens <= context) entry.maxOutput = model.max_output_tokens
    if (model.mode === 'embedding' && integer(model.output_vector_size) && model.output_vector_size > 0) entry.dimensions = model.output_vector_size
    if (model.supports_reasoning === false || model.mode === 'embedding' || media) entry.reasoningEfforts = []
    const hosted = ['together_ai', 'deepinfra', 'fireworks_ai', 'novita', 'nvidia_nim'].includes(provider)
    const pricing = prices({ input: model.input_cost_per_token, output: model.output_cost_per_token, cachedInput: model.cache_read_input_token_cost }, 1_000_000)
    if (!hosted && !media && pricing) entry.pricing = pricing
    // Store unit prices independently; v1 pricing remains USD per million tokens only.
    const unitPricing = Object.fromEntries(Object.entries(model).filter(([k, v]) => /_cost_per_(image|second|audio_token|character|minute)$/.test(k) && number(v)))
    if (Object.keys(unitPricing).length) entry.unitPricing = unitPricing
    const existing = database[id.toLowerCase()]
    if (existing && !previous[id.toLowerCase()] && entry.dimensions && existing.capabilities?.embedding) existing.dimensions ??= entry.dimensions
    add(id, entry, 'litellm', true)
  }
  // Official supplements close gaps (e.g. default embedding dimensions) in aggregate feeds.
  for (const [id, verified] of Object.entries(feeds.verified ?? {})) {
    if (!(id in database)) add(id, clone(verified), 'official-supplements')
    else if (!previous[id]) database[id] = { ...database[id], ...clone(verified) }
    if (!previous[id] && verified.pricing === null) {
      delete database[id].pricing
      report.omittedUnverifiedPrices ??= []
      report.omittedUnverifiedPrices.push(id)
    }
    for (const [key, entry] of Object.entries(database)) {
      if (key === '_meta' || previous[key] || key === id || tail(key).replace(/:(free|batch)$/, '') !== id || !entry.capabilities?.embedding) continue
      entry.dimensions = verified.dimensions
      entry.dimensionsSource = verified.source.url
      entry.capabilities = { ...entry.capabilities, ...verified.capabilities }
    }
  }
  // Dimensions belong to the model. Propagate only when all same-ID references agree.
  const dimensionReferences = new Map()
  for (const [id, entry] of Object.entries(database)) {
    if (id === '_meta' || !entry.capabilities?.embedding || !integer(entry.dimensions) || entry.dimensions === 0) continue
    const name = tail(id).replace(/:(free|batch)$/, '')
    if (!dimensionReferences.has(name)) dimensionReferences.set(name, new Set())
    dimensionReferences.get(name).add(entry.dimensions)
  }
  for (const [id, entry] of Object.entries(database)) {
    if (id === '_meta' || previous[id] || !entry.capabilities?.embedding || entry.dimensions) continue
    const refs = dimensionReferences.get(tail(id).replace(/:(free|batch)$/, ''))
    if (refs?.size === 1) entry.dimensions = [...refs][0]
  }
  // Add a bare ID only when it points to one qualified record; omit ambiguous or routing suffixes.
  for (const [id, candidates] of [...aliases].sort(([a], [b]) => a.localeCompare(b))) {
    if (id in database || candidates.size !== 1 || !id || id.includes(':')) continue
    const target = [...candidates][0]
    const entry = clone(database[target])
    delete entry.pricing
    delete entry.pricingSource
    entry.aliasOf = target
    add(id, entry, 'compatibility-aliases')
  }
  report.aliases = Object.values(database).filter(entry => entry?.aliasOf).length
  report.totalEntries = Object.keys(database).length - 1
  report.addedEntries = report.totalEntries - report.previousEntries
  report.modelTypes = {}
  for (const [id, entry] of Object.entries(database)) {
    if (id === '_meta') continue
    const mode = entry.modelType ?? (entry.capabilities?.embedding ? 'embedding' : entry.capabilities?.videoGeneration ? 'video_generation' : entry.capabilities?.imageGeneration ? 'image_generation' : 'chat')
    report.modelTypes[mode] = (report.modelTypes[mode] ?? 0) + 1
  }
  database._meta = { ...database._meta, version, sources: [...new Set([...database._meta.sources, ...Object.values(FEEDS), ...Object.values(feeds.verified ?? {}).map(entry => entry.source.url)])] }
  return { database: { _meta: database._meta, ...Object.fromEntries(Object.entries(database).filter(([id]) => id !== '_meta').sort(([a], [b]) => a.localeCompare(b))) }, report }
}

async function main(args) {
  const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
  const directory = option('--snapshot-dir')
  const version = option('--version')
  if (!directory || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version ?? '')) throw new Error('Usage: node scripts/import-catalogs.mjs --snapshot-dir DIR --version YYYY-MM-DD.N [--fetch] [--output FILE]')
  const output = option('--output') ?? 'v1/modelDatabase.json'
  await mkdir(directory, { recursive: true })
  if (args.includes('--fetch')) {
    for (const [name, url] of Object.entries(FEEDS)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(45_000) })
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      const text = await response.text()
      if (Buffer.byteLength(text) > 20 * 1024 * 1024) throw new Error(`${name}: source is too large`)
      JSON.parse(text)
      await writeFile(join(directory, `${name}.json`), text)
    }
  }
  const previous = JSON.parse(await readFile(output, 'utf8'))
  const key = v => v.split(/[-.]/).map(Number)
  const incoming = key(version), current = key(previous._meta.version)
  const difference = incoming.findIndex((n, i) => n !== current[i])
  if (difference < 0 || incoming[difference] < current[difference]) throw new Error('Use a higher published model database version')
  const feeds = {}, snapshots = {}
  for (const [name, url] of Object.entries(FEEDS)) {
    const bytes = await readFile(join(directory, `${name}.json`))
    feeds[name] = JSON.parse(bytes)
    snapshots[name] = { url, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  feeds.verified = JSON.parse(await readFile('sources/verified-models.json', 'utf8'))
  const { database, report } = buildCatalog(previous, feeds, version)
  database._meta.importSnapshot = { date: version.split('.')[0], sources: snapshots }
  const text = JSON.stringify(database, null, 2) + '\n'
  if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new Error('Imported catalog exceeds the v1 client size limit')
  await writeFile(output, text)
  await writeFile('IMPORT-REPORT.json', JSON.stringify({ version, ...report, snapshots }, null, 2) + '\n')
  console.log(JSON.stringify({ version, bytes: Buffer.byteLength(text), ...report }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
}
