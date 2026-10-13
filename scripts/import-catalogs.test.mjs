import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalog } from './import-catalogs.mjs'

const previous = entries => ({ _meta: { schemaVersion: 1, version: '2026-10-13.1', sources: [] }, ...entries })
const model = (id, extra = {}) => ({ id, name: id, reasoning: false, tool_call: false, modalities: { input: ['text'], output: ['text'] }, limit: { context: 32000, output: 4000 }, ...extra })
const feeds = (extra = {}) => ({ 'models-dev': {}, 'models-dev-canonical': {}, 'openrouter-all': { data: [] }, litellm: {}, ...extra })

test('curated values survive imports and normalized ID spellings, while first-party pricing wins over hosted prices', () => {
  const original = previous({ 'claude-sample-4.5': { displayName: 'Curated', contextWindow: 200000, maxOutput: 64000, capabilities: { reasoning: true }, pricing: { input: 9 }, reasoningEfforts: ['high', 'max'] } })
  const result = buildCatalog(original, feeds({
    'models-dev': { anthropic: { models: {
      'claude-sample-4-5': model('claude-sample-4-5', { cost: { input: 1, output: 2 } }),
      'lab-sample-1': model('lab-sample-1', { cost: { input: 3, output: 4 } }),
    } }, deepinfra: { models: { 'lab-sample-1': model('lab-sample-1', { cost: { input: 0.1, output: 0.2 } }) } } },
    'models-dev-canonical': { 'anthropic/claude-sample-4-5': model('anthropic/claude-sample-4-5') },
  }), '2026-10-13.2')
  assert.equal(result.database['anthropic/claude-sample-4-5'].contextWindow, 200000)
  assert.equal(result.database['claude-sample-4.5'].pricing.input, 9)
  assert.equal(result.database['claude-sample-4-5'].contextWindow, 200000)
  assert.deepEqual(result.database['claude-sample-4-5'].reasoningEfforts, ['high', 'max'])
  assert.equal(result.database['lab-sample-1'].pricing.input, 3)
  assert.equal(original._meta.version, '2026-10-13.1')
})

test('OpenRouter token prices convert to USD per million, free variants stay scoped, and missing facts remain unknown', () => {
  const result = buildCatalog(previous({}), feeds({ 'openrouter-all': { data: [
    { id: 'vendor/reasoner-1', name: 'Reasoner', context_length: 100000, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, pricing: { prompt: '0.000001', completion: '0.000003', input_cache_read: '0.0000001' }, supported_parameters: ['tools', 'reasoning_effort'], reasoning: { supported_efforts: ['low', 'high', 'unknown'] } },
    { id: 'vendor/reasoner-1:free', name: 'Reasoner Free', context_length: 8000, architecture: { input_modalities: ['text'], output_modalities: ['text'] }, pricing: { prompt: '0', completion: '0' } },
    { id: 'vendor/image-1', name: 'Image', context_length: 0, architecture: { input_modalities: ['text'], output_modalities: ['image'] }, pricing: { prompt: '0', completion: '0', image: '0.04' } },
  ] } }), '2026-10-13.2')
  const paid = result.database['vendor/reasoner-1']
  assert.deepEqual(paid.pricing, { input: 1, output: 3, cachedInput: 0.1 })
  assert.equal(paid.capabilities.vision, true)
  assert.equal(paid.capabilities.functionCalling, true)
  assert.deepEqual(paid.reasoningEfforts, ['low', 'high'])
  assert.equal('maxOutput' in paid, false)
  assert.equal(result.database['vendor/reasoner-1:free'].pricing.input, 0)
  assert.equal('reasoner-1:free' in result.database, false)
  assert.equal('pricing' in result.database['vendor/image-1'], false)
})

test('image billing configurations and editor operations are excluded; embeddings retain their actual model dimensions', () => {
  const result = buildCatalog(previous({}), feeds({ litellm: {
    'high/1024-x-1024/gpt-image-1': { litellm_provider: 'openai', mode: 'image_generation', output_cost_per_image: 0.1 },
    'stability/erase': { litellm_provider: 'stability', mode: 'image_edit' },
    'openai/unknown-limits': { litellm_provider: 'openai', mode: 'chat', max_tokens: 9999 },
    'voyage/embed-1': { litellm_provider: 'voyage', mode: 'embedding', max_input_tokens: 32000, output_vector_size: 1024, input_cost_per_token: 0.00000012 },
    'black_forest_labs/flux-example-1': { litellm_provider: 'black_forest_labs', mode: 'image_generation', output_cost_per_image: 0.04 },
  } }), '2026-10-13.2')
  assert.equal('high/1024-x-1024/gpt-image-1' in result.database, false)
  assert.equal('erase' in result.database, false)
  assert.equal('unknown-limits' in result.database, false)
  assert.equal(result.database['embed-1'].capabilities.embedding, true)
  assert.equal(result.database['embed-1'].dimensions, 1024)
  assert.equal(result.database['embed-1'].pricing.input, 0.12)
  assert.equal('maxOutput' in result.database['embed-1'], false)
  assert.equal('pricing' in result.database['flux-example-1'], false)
  assert.equal(result.database['flux-example-1'].unitPricing.output_cost_per_image, 0.04)
})

test('bare aliases require an unambiguous model identity and do not inherit reseller pricing', () => {
  const result = buildCatalog(previous({}), feeds({
    'models-dev-canonical': { 'lab-a/shared-1': model('lab-a/shared-1'), 'lab-b/shared-1': model('lab-b/shared-1'), 'lab-a/unique-1': model('lab-a/unique-1') },
    'models-dev': { deepinfra: { models: { 'lab-c/hosted-1': model('lab-c/hosted-1', { cost: { input: 1, output: 2 } }) } } },
  }), '2026-10-13.2')
  assert.equal('shared-1' in result.database, false)
  assert.equal(result.database['unique-1'].aliasOf, 'lab-a/unique-1')
  assert.equal('pricing' in result.database['hosted-1'], false)
  assert.equal('pricing' in result.database['lab-c/hosted-1'], false)
  assert.equal(result.report.aliases, 2)
})

test('official embedding supplements enrich qualified IDs without altering curated defaults', () => {
  const result = buildCatalog(previous({ 'embed-1': { displayName: 'Custom baseline', contextWindow: 123, dimensions: 512, capabilities: { embedding: true } } }), feeds({
    'models-dev-canonical': { 'vendor/embed-1': model('vendor/embed-1', { type: 'embedding', limit: { context: 32000, output: 0 } }) },
    verified: { 'embed-1': { displayName: 'Embed', contextWindow: 32000, dimensions: 1024, capabilities: { embedding: true }, modelType: 'embedding', source: { catalog: 'Official documentation', url: 'https://vendor.example/models' } } },
  }), '2026-10-13.2')
  assert.equal(result.database['embed-1'].contextWindow, 123)
  assert.equal(result.database['embed-1'].dimensions, 512)
  assert.equal(result.database['vendor/embed-1'].dimensions, 1024)
})


test('official verification can withdraw a dubious source price without inventing a replacement', () => {
  for (const includeAggregate of [true, false]) {
  const result = buildCatalog(previous({}), feeds({ litellm: includeAggregate ? {
    'embed-example-light': { litellm_provider: 'cohere', mode: 'embedding', max_input_tokens: 512, input_cost_per_token: 0.0001 },
  } : {}, verified: {
    'embed-example-light': { displayName: 'Embed', contextWindow: 512, dimensions: 384, capabilities: { embedding: true }, modelType: 'embedding', pricing: null, source: { url: 'https://vendor.example/models' } },
  } }), '2026-10-13.2')
  assert.equal('pricing' in result.database['embed-example-light'], false)
  assert.equal(result.database['embed-example-light'].dimensions, 384)
  }
})
