import { unzip } from 'fflate'
import type { Json, Tables } from './lib/database.types'

export const LCP_KINDS = {
  frames: 'frames', weapons: 'mech weapons', systems: 'mech systems', pilot_gear: 'pilot gear',
  talents: 'talents', core_bonuses: 'core bonuses', tags: 'tags', manufacturers: 'manufacturers',
} as const
export type LcpKind = keyof typeof LCP_KINDS
export type LcpManifest = { name: string; author: string; version: string; description: string } & Record<string, Json>
export type LcpItem = { id: string; kind: LcpKind; data: Record<string, Json> }
export type LcpPack = { manifest: LcpManifest; items: LcpItem[]; ignored: string[]; warnings: string[] }
export type InstalledPack = Tables<'content_packs'>
export type InstalledItem = Pick<Tables<'content_items'>, 'id' | 'pack_id' | 'kind'>

// Recognise core items across packs, including the two legacy local seed packs.
// Checking IDs and types avoids mistaking a similarly named homebrew pack for core.
export function hasCoreContent(items: InstalledItem[]) {
  const required: [string, LcpKind][] = [
    ['mf_standard_pattern_i_everest', 'frames'], ['mw_assault_rifle', 'weapons'],
    ['ms_custom_paint_job', 'systems'], ['pg_archaic_melee', 'pilot_gear'],
    ['t_ace', 'talents'], ['cb_auto_stabilizing_hardpoints', 'core_bonuses'], ['tg_burn', 'tags'],
  ]
  return required.every(([id, kind]) => items.some(item => item.id === id && item.kind === kind))
}

export const MAX_LCP_BYTES = 15 * 1024 * 1024
const MAX_JSON_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 20 * 1024 * 1024
const MAX_ITEMS = 10_000

class LcpError extends Error {}
const object = (value: unknown): value is Record<string, Json> => !!value && typeof value === 'object' && !Array.isArray(value)

export const plainPackText = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Read only the root files used by this character manager. Never extract files onto disk.
export async function readLcp(bytes: Uint8Array): Promise<LcpPack> {
  if (bytes.length > MAX_LCP_BYTES) throw new LcpError('Choose an LCP smaller than 15 MB.')
  const ignored: string[] = []
  const seen = new Set<string>()
  let size = 0
  let count = 0
  let files: Record<string, Uint8Array>
  try {
    files = await new Promise((resolve, reject) => {
      unzip(bytes, { filter(file) {
        if (++count > 2000) throw new LcpError('This archive contains too many files.')
        const root = !file.name.includes('/') && !file.name.includes('\\')
        const kind = file.name.replace(/\.json$/, '')
        const supported = root && (file.name === 'lcp_manifest.json' || (file.name.endsWith('.json') && Object.hasOwn(LCP_KINDS, kind)))
        if (!supported) { if (!file.name.endsWith('/')) ignored.push(file.name); return false }
        if (seen.has(file.name)) throw new LcpError(`The archive contains two copies of ${file.name}.`)
        seen.add(file.name)
        size += file.originalSize
        if (file.originalSize > MAX_JSON_BYTES || size > MAX_TOTAL_BYTES) throw new LcpError('The JSON content is too large. Split this into smaller packs.')
        return true
      } }, (error, result) => error ? reject(error) : resolve(result))
    })
  } catch (error) {
    if (error instanceof LcpError) throw error
    throw new LcpError('Could not open this archive. Choose a valid .lcp file, not an extracted folder.')
  }
  const read = (name: string): unknown => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files[name])) }
    catch { throw new LcpError(`${name} is not valid UTF-8 JSON. Fix it and export the pack again.`) }
  }
  if (!files['lcp_manifest.json']) throw new LcpError('Missing lcp_manifest.json at the top level of the archive.')
  const raw = read('lcp_manifest.json')
  if (!object(raw)) throw new LcpError('The pack manifest must be a JSON object.')
  for (const key of ['name', 'author', 'version'] as const)
    if (typeof raw[key] !== 'string' || !raw[key].trim() || raw[key].length > 300) throw new LcpError(`The manifest needs a valid ${key}.`)
  if (typeof raw.description !== 'string') throw new LcpError('The manifest needs a description.')
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(String(raw.version))) throw new LcpError('The pack version should look like 1.0.0.')
  const manifest = { ...raw, name: String(raw.name).trim(), author: String(raw.author).trim(), version: String(raw.version).trim() } as LcpManifest
  const items: LcpItem[] = []
  const ids = new Set<string>()
  for (const kind of Object.keys(LCP_KINDS) as LcpKind[]) {
    const filename = `${kind}.json`
    if (!files[filename]) continue
    const values = read(filename)
    if (!Array.isArray(values)) throw new LcpError(`${filename} must contain a list of items.`)
    for (const value of values) {
      if (!object(value) || typeof value.id !== 'string' || !value.id.trim() || value.id !== value.id.trim() || value.id.length > 300)
        throw new LcpError(`Every item in ${filename} needs a non-empty ID without surrounding spaces.`)
      if (typeof value.name !== 'string' || !value.name.trim()) throw new LcpError(`Item ${value.id} in ${filename} needs a name.`)
      if (ids.has(value.id)) throw new LcpError(`Duplicate item ID: ${value.id}. Every item in a pack needs its own ID.`)
      ids.add(value.id)
      items.push({ id: value.id, kind, data: value })
      if (items.length > MAX_ITEMS) throw new LcpError('Import at most 10,000 items at once. Split this into smaller packs.')
    }
  }
  if (!items.length) throw new LcpError('This pack contains no supported pilot or mech content.')
  const warnings: string[] = []
  if (raw.v3 === true) warnings.push('This is a COMP/CON v3 pack. Some advanced effects are not displayed by this site yet.')
  if (Array.isArray(raw.dependencies) && raw.dependencies.length) warnings.push('This pack declares dependencies. Check its required packs and versions before importing; dependency requirements are not verified automatically.')
  return { manifest, items, ignored, warnings }
}

// Preview against metadata only; the database repeats these checks when saving.
export function planLcp(pack: LcpPack, packs: InstalledPack[], installed: InstalledItem[]) {
  const existing = packs.find(row => row.name === pack.manifest.name) ?? null
  const byId = new Map(installed.map(item => [item.id, item]))
  const incoming = new Set(pack.items.map(item => item.id))
  const conflicts: { id: string; reason: string }[] = []
  let added = 0
  let updated = 0
  for (const item of pack.items) {
    const old = byId.get(item.id)
    if (!old) added++
    else if (old.pack_id !== existing?.id) conflicts.push({ id: item.id, reason: `belongs to ${packs.find(row => row.id === old.pack_id)?.name ?? 'another pack'}` })
    else if (old.kind !== item.kind) conflicts.push({ id: item.id, reason: 'would change the item type' })
    else updated++
  }
  const retained = installed.filter(item => item.pack_id === existing?.id && !incoming.has(item.id)).length
  return { existing, added, updated, retained, conflicts }
}
