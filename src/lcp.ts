import { strToU8, unzip, zipSync } from 'fflate'
import type { Json, Tables } from './lib/database.types'
import { errorsOf, validateItem } from './contentEditor'

export const LCP_KINDS = {
  frames: 'Frames', weapons: 'Mech weapons', systems: 'Mech systems', mods: 'Weapon mods', pilot_gear: 'Pilot gear',
  talents: 'Talents', core_bonuses: 'Core bonuses', tags: 'Tags', manufacturers: 'Manufacturers', actions: 'Actions', rules: 'Rules',
} as const
export type LcpKind = keyof typeof LCP_KINDS
const IMPORTED_KINDS = Object.keys(LCP_KINDS) as LcpKind[]
// The campaign's own wording: an official action or rule keeps its seed id, so a pack can only add its own (hb_ ids), and a bad row is skipped, not fatal.
const HOMEBREW_ONLY: LcpKind[] = ['actions', 'rules']
const HOMEBREW_ID_PREFIX = 'hb_'
type LcpManifest = { name: string; author: string; version: string; description: string } & Record<string, Json>
type LcpItem = { id: string; kind: LcpKind; data: Record<string, Json> }
export type LcpPack = { manifest: LcpManifest; items: LcpItem[]; ignored: string[]; warnings: string[] }
export type InstalledPack = Tables<'content_packs'>
// "edited": an owner has edited this item in the content editor (content_items.edited), and pack updates keep that edit.
export type InstalledItem = Pick<Tables<'content_items'>, 'id' | 'pack_id' | 'kind'> & { edited?: boolean }

// Recognise core items across packs, including the two legacy local seed packs.
// Checking IDs and types avoids mistaking a similarly named homebrew pack for core.
export function hasCoreContent(items: InstalledItem[]) {
  const required: [string, LcpKind][] = [
    ['mf_standard_pattern_i_everest', 'frames'], ['mw_assault_rifle', 'weapons'],
    ['ms_custom_paint_job', 'systems'], ['wm_stabilizer_mod', 'mods'], ['pg_archaic_melee', 'pilot_gear'],
    ['t_ace', 'talents'], ['cb_auto_stabilizing_hardpoints', 'core_bonuses'], ['tg_burn', 'tags'],
  ]
  return required.every(([id, kind]) => items.some(item => item.id === id && item.kind === kind))
}

// Core is installed but lacks some item the current core seed has (new official or base action items).
// "seedIds" are the ids from coreContent, which is loaded on demand, so the caller passes them in.
export function coreNeedsUpdate(items: InstalledItem[], seedIds: string[]) {
  const have = new Set(items.map(item => item.id))
  return hasCoreContent(items) && seedIds.some(id => !have.has(id))
}

export const MAX_LCP_BYTES = 15 * 1024 * 1024
const MAX_JSON_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 20 * 1024 * 1024
const MAX_ITEMS = 10_000

class LcpError extends Error {}
const object = (value: unknown): value is Record<string, Json> => !!value && typeof value === 'object' && !Array.isArray(value)

// COMP/CON's active_effects only reword the rules text (developer decision 2026-11-21), so imports drop them at any depth.
export function withoutActiveEffects<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutActiveEffects) as T
  if (!object(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'active_effects').map(([key, v]) => [key, withoutActiveEffects(v)])) as T
}

export const plainPackText = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Why an actions.json or rules.json row can't be imported, using the editor's own checks. Warnings (not errors) pass.
function homebrewRowProblem(kind: LcpKind, value: unknown): string | null {
  if (!object(value) || typeof value.id !== 'string' || !value.id.trim()) return 'it has no ID.'
  if (!value.id.startsWith(HOMEBREW_ID_PREFIX)) return `${value.id} isn't a homebrew ID. IDs here start with ${HOMEBREW_ID_PREFIX}.`
  const first = errorsOf(validateItem(kind, withoutActiveEffects(value), { id: value.id, tags: new Map(), statIds: [] }))[0]
  return first ? `${value.id}: ${first.text}` : null
}

// Read only the root files used by this character manager. Never extract files onto disk.
export async function readLcp(bytes: Uint8Array): Promise<LcpPack> {
  if (bytes.length > MAX_LCP_BYTES) throw new LcpError('That file is over 15 MB.')
  const ignored: string[] = []
  const seen = new Set<string>()
  let size = 0
  let count = 0
  let files: Record<string, Uint8Array>
  try {
    files = await new Promise((resolve, reject) => {
      unzip(bytes, { filter(file) {
        if (++count > 2000) throw new LcpError('That pack has too many files.')
        const root = !file.name.includes('/') && !file.name.includes('\\')
        const kind = file.name.replace(/\.json$/, '')
        const supported = root && (file.name === 'lcp_manifest.json' || (file.name.endsWith('.json') && (IMPORTED_KINDS as string[]).includes(kind)))
        if (!supported) { if (!file.name.endsWith('/')) ignored.push(file.name); return false }
        if (seen.has(file.name)) throw new LcpError(`The pack has two copies of ${file.name}.`)
        seen.add(file.name)
        size += file.originalSize
        if (file.originalSize > MAX_JSON_BYTES || size > MAX_TOTAL_BYTES) throw new LcpError('That pack is too large.')
        return true
      } }, (error, result) => error ? reject(error) : resolve(result))
    })
  } catch (error) {
    if (error instanceof LcpError) throw error
    throw new LcpError("That isn't a valid .lcp file.")
  }
  const read = (name: string): unknown => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files[name])) }
    catch { throw new LcpError(`${name} isn't valid JSON.`) }
  }
  if (!files['lcp_manifest.json']) throw new LcpError('The pack has no lcp_manifest.json.')
  const raw = read('lcp_manifest.json')
  if (!object(raw)) throw new LcpError("The manifest isn't valid.")
  for (const key of ['name', 'author', 'version'] as const)
    if (typeof raw[key] !== 'string' || !raw[key].trim() || raw[key].length > 300) throw new LcpError(`The manifest needs a valid ${key}.`)
  if (typeof raw.description !== 'string') throw new LcpError('The manifest needs a description.')
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(String(raw.version))) throw new LcpError('The pack version should look like 1.0.0.')
  const manifest = { ...raw, name: String(raw.name).trim(), author: String(raw.author).trim(), version: String(raw.version).trim() } as LcpManifest
  const items: LcpItem[] = []
  const warnings: string[] = []
  const ids = new Set<string>()
  for (const kind of IMPORTED_KINDS) {
    const filename = `${kind}.json`
    if (!files[filename]) continue
    const values = read(filename)
    if (!Array.isArray(values)) throw new LcpError(`${filename} must contain a list of items.`)
    for (const value of values) {
      if (HOMEBREW_ONLY.includes(kind)) {
        const why = homebrewRowProblem(kind, value)
        if (why) { warnings.push(`Skipped a row in ${filename}: ${why}`); continue }
      }
      if (!object(value) || typeof value.id !== 'string' || !value.id.trim() || value.id !== value.id.trim() || value.id.length > 300)
        throw new LcpError(`Every item in ${filename} needs an ID.`)
      if (typeof value.name !== 'string' || !value.name.trim()) throw new LcpError(`Item ${value.id} in ${filename} needs a name.`)
      if (ids.has(value.id)) throw new LcpError(`Duplicate item ID: ${value.id}.`)
      ids.add(value.id)
      items.push({ id: value.id, kind, data: withoutActiveEffects(value) })
      if (items.length > MAX_ITEMS) throw new LcpError('A pack can have at most 10,000 items.')
    }
  }
  if (!items.length) throw new LcpError('This pack has no content the site uses.')
  if (raw.v3 === true) warnings.push("This is a COMP/CON v3 pack. Some advanced effects aren't shown.")
  if (Array.isArray(raw.dependencies) && raw.dependencies.length) warnings.push('This pack needs other packs. Check they are imported.')
  return { manifest, items, ignored, warnings }
}

// An .lcp (a zip of JSON files, one per kind) from items, for the homebrew export. readLcp reads it back.
export function writeLcp(manifest: Record<string, Json>, items: { kind: LcpKind; data: Json }[]): Uint8Array {
  const files: Record<string, Uint8Array> = { 'lcp_manifest.json': strToU8(JSON.stringify(manifest, null, 2)) }
  for (const kind of Object.keys(LCP_KINDS) as LcpKind[]) {
    const list = items.filter(item => item.kind === kind).map(item => item.data)
    if (list.length) files[`${kind}.json`] = strToU8(JSON.stringify(list, null, 2))
  }
  return zipSync(files)
}

// Preview against metadata only; the database repeats these checks when saving.
export function planLcp(pack: LcpPack, packs: InstalledPack[], installed: InstalledItem[]) {
  const existing = packs.find(row => row.name === pack.manifest.name) ?? null
  const byId = new Map(installed.map(item => [item.id, item]))
  const incoming = new Set(pack.items.map(item => item.id))
  const conflicts: { id: string; reason: string }[] = []
  let added = 0
  let updated = 0
  let edited = 0
  for (const item of pack.items) {
    const old = byId.get(item.id)
    if (!old) added++
    else if (old.pack_id !== existing?.id) conflicts.push({ id: item.id, reason: `Belongs to ${packs.find(row => row.id === old.pack_id)?.name ?? 'another pack'}` })
    else if (old.kind !== item.kind) conflicts.push({ id: item.id, reason: 'Would change the item type' })
    else {
      updated++
      if (old.edited) edited++
    }
  }
  const retained = installed.filter(item => item.pack_id === existing?.id && !incoming.has(item.id)).length
  return { existing, added, updated, edited, retained, conflicts }
}
