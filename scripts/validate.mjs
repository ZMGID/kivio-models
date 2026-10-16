import { readFile } from 'node:fs/promises'
import { assertOfficialPricing } from './official-pricing.mjs'

export const MODEL_DATABASE_REPO = 'ZMGID/kivio-models'
const MAX_BYTES = 4 * 1024 * 1024
export function versionKey(version) {
  if (typeof version !== 'string' || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version)) throw new Error('Expected model database version YYYY-MM-DD.N')
  const parts = version.split(/[-.]/).map(Number)
  if (parts.some(n => !Number.isInteger(n) || n > 4294967295) || parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[2] > 31 || parts[3] < 1) throw new Error('Invalid model database version')
  return parts
}
export function compareVersions(a, b) {
  const left = versionKey(a), right = versionKey(b)
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i])
  return 0
}
export function validateDatabase(text) {
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Model database is too large')
  const data = JSON.parse(text)
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!object(data) || data._meta?.schemaVersion !== 1) throw new Error('Unsupported model database schema')
  versionKey(data._meta.version)
  if (Object.keys(data).length < 2) throw new Error('Model database is empty')
  for (const [id, entry] of Object.entries(data)) {
    if (id === '_meta') continue
    const invalid = () => { throw new Error(`Invalid model database entry: ${id}`) }
    if (!id || id.trim() !== id || id.toLowerCase() !== id || !object(entry) || typeof entry.displayName !== 'string' || !entry.displayName.trim()) invalid()
    for (const key of ['contextWindow', 'maxOutput', 'dimensions']) {
      const n = entry[key]
      if ((key === 'contextWindow' || n !== undefined) && (!Number.isInteger(n) || n < 0 || n > 4294967295)) invalid()
    }
    if (!object(entry.capabilities) || Object.values(entry.capabilities).some(v => typeof v !== 'boolean')) invalid()
    if (entry.pricing !== undefined && (!object(entry.pricing) || Object.values(entry.pricing).some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0))) invalid()
    if (entry.reasoningEfforts !== undefined && (!Array.isArray(entry.reasoningEfforts) || entry.reasoningEfforts.some(l => !['minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(l)))) invalid()
    for (const key of ['thinkingOff', 'multilingual']) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') invalid()
    if (entry.temperature !== undefined && (typeof entry.temperature !== 'number' || !Number.isFinite(entry.temperature) || entry.temperature < 0 || entry.temperature > 2)) invalid()
  }
  return data
}

const file = process.argv[2] ?? 'v1/modelDatabase.json'
const data = validateDatabase(await readFile(file, 'utf8'))
assertOfficialPricing(data, JSON.parse(await readFile(new URL('../sources/official-pricing.json', import.meta.url), 'utf8')))
if (process.argv[3]) {
  const previous = validateDatabase(await readFile(process.argv[3], 'utf8'))
  if (compareVersions(data._meta.version, previous._meta.version) <= 0) throw new Error('Every published update needs a higher version')
}
console.log(`Validated ${data._meta.version}: ${Object.keys(data).length - 1} models`)
