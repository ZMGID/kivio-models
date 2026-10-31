import { isDeepStrictEqual } from 'node:util'

const normalize = id => id.toLowerCase().replaceAll('.', '-')
const PRICE_FIELDS = ['pricing', 'pricingSource', 'unitPricing', 'modalityPricing', 'pricingTiers']

export function assertOfficialPricing(database, policy) {
  const expected = structuredClone(database)
  applyOfficialPricing(expected, policy)
  for (const [id, entry] of Object.entries(database)) {
    if (id === '_meta') continue
    for (const field of PRICE_FIELDS) {
      if (!isDeepStrictEqual(entry[field], expected[id][field])) throw new Error(`Price differs from official registry: ${id}.${field}`)
    }
  }
  if (!isDeepStrictEqual(database._meta.pricingPolicy, expected._meta.pricingPolicy)) throw new Error('Missing or stale official pricing policy')
}

/** The reference-price registry owns published prices, including reviewed catalog overrides. */
export function applyOfficialPricing(database, policy) {
  if (policy.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(policy.asOf)) throw new Error('Invalid official pricing policy')
  const rate = policy.exchangeRate
  if (!Number.isFinite(rate?.cnyPerUsd) || rate.cnyPerUsd <= 0 || !rate.date || !rate.source) throw new Error('A dated fixed CNY/USD rate is required')
  const records = policy.models
  const index = new Map()
  for (const [id, record] of Object.entries(records)) {
    if (!/^https:\/\//.test(record.source ?? '') || !['USD', 'CNY'].includes(record.currency)) throw new Error(`Invalid official price source: ${id}`)
    for (const alias of [id, ...(record.aliases ?? [])]) {
      const key = normalize(alias)
      if (index.has(key) && index.get(key) !== id) throw new Error(`Ambiguous official price alias: ${alias}`)
      index.set(key, id)
    }
  }
  const resolve = (id, seen = new Set()) => {
    if (!id || seen.has(id)) return undefined
    seen.add(id)
    const direct = index.get(normalize(id))
    if (direct) return direct
    // Free/batch routes need an explicit official quote, never their paid parent's rate.
    if (/(?:[:/-]free|:batch)$/.test(id) || id.startsWith('ft:')) return undefined
    const qualified = index.get(normalize(id.split('/').at(-1)))
    if (qualified) return qualified
    const entry = database[id]
    return resolve(entry?.aliasOf, seen) ?? resolve(entry?.source?.curatedBase, seen)
  }
  const convert = (values, currency) => Object.fromEntries(Object.entries(values).map(([key, value]) => {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid official price: ${key}`)
    return [key, Number((value / (currency === 'CNY' ? rate.cnyPerUsd : 1)).toPrecision(12))]
  }))
  const report = { verifiedEntries: 0, changedPrices: [], withdrawnPrices: [] }
  for (const [id, entry] of Object.entries(database)) {
    if (id === '_meta') continue
    const before = Object.fromEntries(PRICE_FIELDS.filter(key => entry[key] !== undefined).map(key => [key, structuredClone(entry[key])]))
    for (const key of PRICE_FIELDS) delete entry[key]
    const model = resolve(id)
    if (model) {
      const record = records[model]
      if (record.pricing) entry.pricing = convert(record.pricing, record.currency)
      if (record.unitPricing) entry.unitPricing = convert(record.unitPricing, record.currency)
      if (record.modalityPricing) entry.modalityPricing = Object.fromEntries(Object.entries(record.modalityPricing).map(([modality, prices]) => [modality, convert(prices, record.currency)]))
      if (record.tiers) entry.pricingTiers = record.tiers.map(tier => ({ ...tier, pricing: convert(tier.pricing, record.currency) }))
      entry.pricingSource = {
        kind: record.kind ?? 'official', url: record.source, date: policy.asOf, model,
        currency: 'USD', ...(record.pricing || record.modalityPricing ? { tokenUnit: 'per million tokens' } : {}),
        ...(record.region ? { region: record.region } : {}),
        ...(record.condition ? { condition: record.condition } : {}),
        ...(record.currency === 'CNY' ? { originalCurrency: 'CNY',
          ...(record.pricing ? { originalPricing: record.pricing } : {}), exchangeRate: rate } : {}),
        ...(record.currency === 'CNY' && record.unitPricing ? { originalUnitPricing: record.unitPricing } : {}),
        ...(record.currency === 'CNY' && record.modalityPricing ? { originalModalityPricing: record.modalityPricing } : {}),
      }
      report.verifiedEntries++
    } else if (before.pricing || before.unitPricing || before.modalityPricing) report.withdrawnPrices.push(id)
    if (!isDeepStrictEqual(before.pricing, entry.pricing)
      || !isDeepStrictEqual(before.unitPricing, entry.unitPricing)
      || !isDeepStrictEqual(before.modalityPricing, entry.modalityPricing)
      || !isDeepStrictEqual(before.pricingTiers, entry.pricingTiers)) report.changedPrices.push(id)
  }
  database._meta.pricingPolicy = { asOf: policy.asOf, currency: 'USD', exchangeRate: rate, baseline: policy.baseline }
  database._meta.sources = [...new Set([...database._meta.sources, rate.source, ...Object.values(records).map(record => record.source)])]
  return report
}
