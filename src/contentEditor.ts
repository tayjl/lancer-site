import { capitalise, orList, sameName } from './text'
import { BONUS_REGISTRY, bonusDef, bonusValue, personalDef, type BonusDef, type BonusFilter } from './bonuses'
import { ICON_CHOICES } from './commendations'
import { coreCheckBonuses } from './coreRules'
import { flatDamage } from './damage'
import { defIds, defList } from './definitions'
import { IMAGE_PATH } from './images'
import type { LcpKind } from './lcp'
import { REQUIREMENT_KINDS } from './gameData'
import { EXOTIC, EXOTIC_TAG } from './rules'
import { numberKeyOf, SECTIONS } from './rulesData'

// The content editor's rules (ContentEditorView.vue): the kinds it edits, new ids, and what makes an item's data
// acceptable to save. Pure, so it's tested without a database (src/contentEditor.test.ts).

// The one pack every new item goes in, made the first time an owner makes one.
export const HOMEBREW_PACK = 'Campaign homebrew'

// The "site" kinds (bionics, factions) aren't pack content: they're rows in their own tables. "prefix" starts a new
// id. Kinds other than the site ones are also edited through the raw-data box (with the live preview).
export type EditorKind = LcpKind | 'bionics' | 'factions' | 'commendations'
export type KindInfo = { key: EditorKind; label: string; singular: string; icon: string; prefix: string; site: boolean }
const kind = (key: EditorKind, label: string, singular: string, icon: string, prefix: string, site = false): KindInfo =>
  ({ key, label, singular, icon, prefix, site })
export const KINDS: KindInfo[] = [
  kind('frames', 'Frames', 'frame', 'frame', 'hb_mf_'),
  kind('weapons', 'Weapons', 'weapon', 'weapon', 'hb_mw_'),
  kind('systems', 'Systems', 'system', 'system', 'hb_ms_'),
  kind('mods', 'Weapon mods', 'weapon mod', 'mod', 'hb_wm_'),
  kind('pilot_gear', 'Pilot gear', 'pilot gear', 'pilot', 'hb_pg_'),
  kind('talents', 'Talents', 'talent', 'talent', 'hb_t_'),
  kind('core_bonuses', 'Core bonuses', 'core bonus', 'corebonus', 'hb_cb_'),
  kind('tags', 'Tags', 'tag', 'flag', 'hb_tg_'),
  kind('actions', 'Actions', 'action', 'flag', 'hb_act_'),
  kind('rules', 'Rules', 'rule', 'book-open', 'hb_rule_'),
  kind('manufacturers', 'Manufacturers', 'manufacturer', 'manufacturer', 'hb_mfr_'),
  kind('bionics', 'Biomods', 'biomod', 'mod', '', true),
  kind('factions', 'Factions', 'faction', 'manufacturer', '', true),
  kind('commendations', 'Commendations', 'commendation', 'medal', '', true),
]
export const kindInfo = (key: EditorKind) => KINDS.find((k) => k.key === key)!

// The editor's tab groups (the top tab row), each with its kinds in order. Definitions isn't a kind: it's a tab of its own.
export const DEFINITIONS_TAB = 'definitions'
export const TAB_GROUPS: { label: string; tabs: string[] }[] = [
  { label: 'Mech content', tabs: ['frames', 'weapons', 'systems', 'mods', 'core_bonuses', 'manufacturers'] },
  { label: 'Pilot content', tabs: ['pilot_gear', 'talents'] },
  { label: 'Combat rules', tabs: ['rules', 'actions', 'tags', DEFINITIONS_TAB] },
  { label: 'Campaign', tabs: ['bionics', 'factions', 'commendations'] },
]
// The group a ?cat= belongs to (the first when it's unknown), and the first tab a group opens.
export const groupOf = (cat: unknown) => TAB_GROUPS.find((g) => g.tabs.includes(String(cat))) ?? TAB_GROUPS[0]

export type Data = Record<string, unknown>
// Every item whose manufacturer is Exotic carries the Exotic Gear tag (rules.ts). The tag can't be removed while it is, and
// the save adds it if it's missing (withExoticTag), whatever the form or the raw data box did. Biomods have no tags.
const EXOTIC_TAGGED: EditorKind[] = ['weapons', 'systems', 'mods', 'pilot_gear', 'frames', 'core_bonuses']
export const lockedTags = (data: Data): string[] => (String(data.source ?? '').trim().toUpperCase() === EXOTIC ? [EXOTIC_TAG] : [])
export function withExoticTag(kind: EditorKind, data: Data): Data {
  const tags = Array.isArray(data.tags) ? data.tags : []
  const missing = EXOTIC_TAGGED.includes(kind) && lockedTags(data).length && !tags.some((tag) => (isObject(tag) ? tag.id : tag) === EXOTIC_TAG)
  return missing ? { ...data, tags: [...tags, { id: EXOTIC_TAG }] } : data
}
export const isObject = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value)

// "Cinder Lance" → "cinder_lance".
export const slug = (text: string) =>
  text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// A new item's id: its kind's prefix and the name's slug, with a number on the end when that's taken.
export function newId(kind: EditorKind, name: string, taken: Iterable<string>) {
  const used = new Set(taken)
  const base = `${kindInfo(kind).prefix}${slug(name) || 'new'}`
  let id = base
  for (let n = 2; used.has(id); n++) id = `${base}_${n}`
  return id
}

// A new item's starting data. Kinds with a form start with its fields; the rest with an id and a name, to fill in the raw box.
export function blankItem(kind: EditorKind, id: string): Data {
  if (kind === 'pilot_gear') return { id, name: '', type: 'Gear', effect: '', description: '' }
  if (kind === 'core_bonuses') return { id, name: '', source: '', effect: '', description: '' }
  if (kind === 'tags') return { id, name: '', description: '' }
  if (kind === 'rules') return { id, name: '', section: 'notes', text: '', order: 1000 }
  if (kind === 'actions') return { id, name: '', activation: 'Quick', terse: '', detail: '', mech: true }
  const gms = { source: 'GMS', license: 'GMS', license_id: '', license_level: 0 }
  if (kind === 'frames') return blankFrame(id)
  if (kind === 'weapons') return { id, name: '', mount: 'Main', type: 'Rifle', ...gms, sp: 1, range: [], damage: [], tags: [], effect: '', description: '' }
  if (kind === 'systems') return { id, name: '', type: 'System', ...gms, sp: 1, tags: [], effect: '', description: '' }
  if (kind === 'mods') return { id, name: '', ...gms, sp: 1, allowed_types: [], tags: [], effect: '', description: '' }
  if (kind === 'talents') return { id, name: '', terse: '', description: '', ranks: RANK_NAMES.map(() => ({ name: '', description: '' })) }
  // A manufacturer's id is a short code the player types (IPS-N), not made from its name.
  if (kind === 'manufacturers') return { id: '', name: '', logo: '', light: '#8a8a99', dark: '#b3b3c2', quote: '', description: '' }
  if (kind === 'factions') return { id: '', name: '' }
  if (kind === 'commendations') return { id: '', name: '', description: '', icon: 'medal' }
  if (kind === 'bionics') return { id: '', name: '', description: '', slot: '', source: '', effect: '', manna_cost: 500, mod_point_cost: 1, retired: false, effect_bonuses: [], actions: [] }
  return { id, name: '' }
}

// A new frame: GMS's (no licence) and its own licence id, with plain starting numbers and one Main mount. Its licence id
// is its own id, which follows the name until it's saved (EditorPane's id watch).
const blankFrame = (id: string): Data => ({
  id, name: '', source: 'GMS', license_id: id, license_level: 0, mechtype: [], description: '', mounts: ['Main'],
  stats: { size: 1, structure: 4, stress: 4, armor: 0, hp: 8, evasion: 8, edef: 8, heatcap: 6, repcap: 5, sensor_range: 5, tech_attack: 0, save: 10, speed: 4, sp: 6 },
  traits: [], core_system: { name: '', active_name: '', active_effect: '', activation: 'Quick' },
})

export type RawResult = { value: Data } | { error: string }
export function parseRaw(text: string): RawResult {
  try {
    const value: unknown = JSON.parse(text)
    return isObject(value) ? { value } : { error: 'The data must be one JSON object.' }
  } catch (error) {
    return { error: `Not valid JSON: ${error instanceof Error ? error.message : 'unreadable'}` }
  }
}

// "Used by WARDEN, LANTERN and 3 more", at most three names.
export const usedBy = (pilots: string[]) =>
  pilots.length ? `Used by ${pilots.slice(0, 3).join(', ')}${pilots.length > 3 ? ` and ${pilots.length - 3} more` : ''}` : ''

// The kinds with a Duplicate button: pack items with a made id (a manufacturer's id is typed, the rest aren't pack items or are keyed by the database).
export const DUPLICABLE: EditorKind[] = ['frames', 'weapons', 'systems', 'mods', 'pilot_gear', 'talents', 'core_bonuses', 'tags', 'actions']

// A new item that starts as a copy of this data: a new id and "Copy of X". A frame that is its own licence stays its own (the new id).
export function duplicateItem(kind: EditorKind, data: Data, taken: Iterable<string>): Data {
  const name = `Copy of ${String(data.name ?? '').trim()}`.trim()
  const id = newId(kind, name, taken)
  const copy: Data = JSON.parse(JSON.stringify(data))
  // An official frame's core power checks live in a code table keyed by its id, so the copy gets them written out.
  const core = isObject(copy.core_system) ? copy.core_system : undefined
  if (kind === 'frames' && core && !Array.isArray(core.check_bonuses)) {
    const checks = coreCheckBonuses(String(data.id), core)
    if (checks.length) core.check_bonuses = JSON.parse(JSON.stringify(checks))
  }
  return { ...copy, id, name, ...(kind === 'frames' && !data.variant && data.license_id === data.id ? { license_id: id } : {}) }
}

// The kinds whose rows can point at other content (their ids sit in lists, requirements, licences and manufacturers).
export const REFERRING_KINDS = ['frames', 'weapons', 'systems', 'mods', 'pilot_gear', 'talents', 'core_bonuses']

// Which other items point at this id: any value in their data that is exactly the id (a licence, manufacturer, tag, built-in
// item, requirement and so on). The row's own id, name and licence fields don't count (a frame's ladder shows in Licence unlocks).
export function referencesTo(id: string, rows: { id: string; data: unknown }[]): string[] {
  const found = (value: unknown, top: boolean): boolean => {
    if (typeof value === 'string') return value === id
    if (Array.isArray(value)) return value.some((entry) => found(entry, false))
    if (!isObject(value)) return false
    return Object.entries(value).some(([key, entry]) => !(top && ['id', 'name', 'license', 'license_id'].includes(key)) && found(entry, false))
  }
  const names = rows.filter((row) => row.id !== id && found(row.data, true)).map((row) => String(isObject(row.data) && row.data.name ? row.data.name : row.id))
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

// What the form's pickers offer, and what validation accepts.
// Weapon and system choices. The data also has a few values the form doesn't offer (a ship-class mount, a "Special" type):
// they're hidden Definitions rows, so they're accepted, and a form showing one keeps it.
export const RANK_NAMES = ['I', 'II', 'III']
export const HEX = /^#[0-9a-f]{6}$/i

// Effect types are declared once in src/bonuses.ts (BONUS_REGISTRY); the editor offers them and checks values from it.
export type BonusType = BonusDef
const FILTER_NOUNS: Record<BonusFilter, string> = { weapon_types: 'weapon type', weapon_sizes: 'weapon size', range_types: 'range type', damage_types: 'damage type' }
// Whether the code applies a bonus anywhere: a declared type, any bonus with an accuracy (a check modifier), and the pilot's
// own stats. Only others are shown on the sheet as "not counted".
export const bonusCounted = (row: Data, statIds: string[] = []) => {
  const id = String(row.id ?? '')
  return !!bonusDef(id) || statIds.includes(id) || row.accuracy !== undefined
}
// The effects with their own value kind (a mount, steps, tags...); stats are plain numbers or formulas.
const effectType = (id: string) => { const def = bonusDef(id); return def && def.value !== 'formula' ? def : undefined }
const isWhole = (value: unknown) => isNumber(value) && Number.isInteger(Number(value)) && Number(value) >= 0
// Why a value doesn't fit its effect bonus, or '' when it does.
function effectValueProblem(type: BonusDef, row: Data): string {
  if (type.value === 'mount' && !defIds('mount_types', true).includes(String(row.val))) return 'needs a mount type.'
  if (type.value === 'number' && !isNumber(row.val)) return 'needs a number.'
  if (type.value === 'whole' && !isWhole(row.val)) return 'needs a whole number, 0 or more.'
  if (type.value === 'tags' && !(Array.isArray(row.val) && row.val.length && row.val.every((tag) => isObject(tag) && typeof tag.id === 'string' && tag.id && (tag.val === undefined || isNumber(tag.val) || typeof tag.val === 'string')))) return 'needs at least one tag.'
  if (type.damageType && row.damage_type !== undefined && !defIds('damage_types', true).includes(String(row.damage_type))) return 'has an unknown damage type.'
  if (type.value === 'steps' && !(Array.isArray(row.val) && row.val.length === 4 && row.val.every((step) => typeof flatDamage(step as string | number) === 'number'))) return 'needs four overcharge steps, such as 1, 1d3, 1d6, 1d6+4.'
  if (type.max && row.max !== undefined && row.max !== '' && (!Number.isInteger(Number(row.max)) || Number(row.max) < 1)) return 'needs a whole number of mounts, 1 or more.'
  for (const key of type.filters ?? []) {
    const allowed = defIds(key, true)
    if (row[key] !== undefined && !(Array.isArray(row[key]) && (row[key] as unknown[]).every((value) => allowed.includes(String(value))))) return `has an unknown ${FILTER_NOUNS[key]}.`
  }
  return ''
}
export const personalBonusTypes = (stats: { id: string; name: string }[]): BonusType[] => stats.map(personalDef)
// Any kind can carry any effect; the personal stats only make sense on what a pilot has (gear, core bonuses, talents, biomods).
export const bonusTypesFor = (kind: EditorKind, stats: { id: string; name: string }[]) =>
  [...BONUS_REGISTRY.filter((type) => !type.hidden), ...(['pilot_gear', 'core_bonuses', 'talents', 'bionics'].includes(kind) ? personalBonusTypes(stats) : [])]

// The frame form's choices (src/components/editor/FrameForm.vue). A frame is its own licence: license_id is its id, unless it
// is an alternate of another frame (an alternate Genghis), when license_id is the original's id and variant its name
// (alternateOf() in mechData.ts reads it); license_level (0 for GMS, otherwise 2) is the rank that unlocks it. "unused" stats are game data the site's mech maths
// leaves out (no grit, save target or sensors); the form still edits them.
export const FRAME_STATS: { key: string; label: string; unused?: boolean }[] = [
  { key: 'size', label: 'Size' }, { key: 'structure', label: 'Structure' }, { key: 'stress', label: 'Stress' }, { key: 'hp', label: 'HP' },
  { key: 'armor', label: 'Armour' }, { key: 'evasion', label: 'Evasion' }, { key: 'edef', label: 'E-defence' }, { key: 'heatcap', label: 'Heat cap' },
  { key: 'repcap', label: 'Repair cap' }, { key: 'speed', label: 'Speed' }, { key: 'tech_attack', label: 'Tech attack' }, { key: 'sp', label: 'System points' },
  { key: 'sensor_range', label: 'Sensors', unused: true }, { key: 'save', label: 'Save target', unused: true },
]

const FORMULA_VARIABLES = { ll: 0, hull: 0, agility: 0, systems: 0, engineering: 0, size: 1 }

// "error" blocks Save; "warn" is shown but doesn't. "field" says which input it belongs to, as a path into the item's
// data ("name", "profiles.1.name", "range.0.val"): the form marks that input and puts the message under it.
export type Problem = { text: string; level: 'error' | 'warn'; field?: string }
const error = (text: string, field?: string): Problem => ({ text, level: 'error', field })
const warn = (text: string, field?: string): Problem => ({ text, level: 'warn', field })
export const errorsOf = (problems: Problem[]) => problems.filter((problem) => problem.level === 'error')

export type Context = {
  // The item's id: it never changes, so pilots keep it.
  id: string
  // Tag id → name, for tags and their values.
  tags: Map<string, string>
  statIds: string[]
  // Every item id (talents grant items) and every frame id (a licence is a frame's), when the editor has them.
  known?: Set<string>
  licences?: Set<string>
  // Every talent and core bonus id, for requirements.
  talents?: Set<string>
  coreBonuses?: Set<string>
  commendations?: Set<string>
  // The frames that are themselves alternates of another (an alternate can't be of one of these).
  alternates?: Set<string>
  // The other factions' or commendations' names, for the one-of-a-name check.
  others?: string[]
}

const isNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const entry = (value: unknown): Data => (isObject(value) ? value : {})
// "Profile 1: range 1 needs a type." inside a part of the item, "Range 1 needs a type." at the top.
const say = (who: string, text: string) => (who ? `${who}: ${capitalise(text)}` : capitalise(text))

// A list of range or damage entries: a type and a number (damage may be dice).
function checkEntries(value: unknown, noun: 'range' | 'damage', label: string, at: string, who: string, out: Problem[]) {
  const types = defIds(noun === 'range' ? 'range_types' : 'damage_types', true)
  for (const [index, item] of list(value).entries()) {
    const row = entry(item)
    const n = index + 1
    if (!types.includes(String(row.type))) out.push(error(say(who, `${label} ${n} needs a type.`), `${at}.${index}.type`))
    if (noun === 'range' ? !isNumber(row.val) : row.val === undefined || typeof flatDamage(row.val as string | number) !== 'number') {
      out.push(error(say(who, noun === 'range' ? `${label} ${n} needs a number.` : `${label} ${n} needs a number or dice such as 1d6+2.`), `${at}.${index}.val`))
    }
  }
}

// The lists every part of an item can have (the item itself, a weapon's profile, a talent's rank): tags, bonuses and
// actions, and (where "numbers") range and damage. "at" is the path in front of each ("profiles.1."), "who" what to call it.
function checkParts(data: Data, at: string, who: string, ctx: Context, out: Problem[], numbers = true) {
  for (const [index, tag] of list(data.tags).entries()) {
    const row = entry(tag)
    const id = String(row.id ?? '')
    const name = ctx.tags.get(id)
    if (!id) out.push(error(say(who, `tag ${index + 1} needs choosing.`), `${at}tags.${index}`))
    else if (!name) out.push(warn(say(who, `Tag "${id}" doesn't exist.`), `${at}tags.${index}`))
    else if (name.includes('{VAL}') && !isNumber(row.val)) out.push(error(say(who, `${name.replace('{VAL}', '').trim()} needs a number.`), `${at}tags.${index}.val`))
  }

  const known = new Set([...BONUS_REGISTRY.filter((type) => type.value === 'formula' && !type.hidden).map((type) => type.id), ...ctx.statIds])
  for (const [index, bonus] of list(data.bonuses).entries()) {
    const row = entry(bonus)
    const id = String(row.id ?? '')
    if (!id) out.push(error(say(who, `effect ${index + 1} needs a type.`), `${at}bonuses.${index}.id`))
    else if (!bonusCounted(row, ctx.statIds)) out.push(warn(say(who, `Effect "${id}" is shown on the sheet but not counted.`), `${at}bonuses.${index}.id`))
    const effect = effectType(id)
    if (row.condition !== undefined && !(typeof row.condition === 'string' && row.condition.length >= 1 && row.condition.length <= 120)) out.push(error(say(who, `effect ${index + 1}: "Only when" must be 120 characters or fewer.`), `${at}bonuses.${index}.condition`))
    const why = effect && effectValueProblem(effect, row)
    if (why) out.push(error(say(who, `effect ${index + 1} ${why}`), `${at}bonuses.${index}.val`))
    // A bonus the build maths doesn't count (an accuracy bonus has no "val") is kept as it is, not evaluated.
    else if (!effect && known.has(id) && bonusValue(row.val, FORMULA_VARIABLES) === null) out.push(error(say(who, `effect ${index + 1} needs a number, or a formula such as {systems}/2.`), `${at}bonuses.${index}.val`))
  }

  if (numbers) {
    checkEntries(data.range, 'range', 'Range', `${at}range`, who, out)
    checkEntries(data.damage, 'damage', 'Damage', `${at}damage`, who, out)
  }
  for (const [index, action] of list(data.actions).entries()) {
    const row = entry(action)
    if (typeof row.name !== 'string' || !row.name.trim()) out.push(error(say(who, `action ${index + 1} needs a name.`), `${at}actions.${index}.name`))
    if (row.activation !== undefined && !defIds('activations', true).includes(String(row.activation))) out.push(warn(say(who, `action ${index + 1} has an unknown activation.`), `${at}actions.${index}.activation`))
    checkEntries(row.range, 'range', `Action ${index + 1} range`, `${at}actions.${index}.range`, who, out)
    checkEntries(row.damage, 'damage', `Action ${index + 1} damage`, `${at}actions.${index}.damage`, who, out)
    // Cards and the information dialog only show an action that says what it does.
    if (typeof row.name === 'string' && row.name.trim() && !String(row.detail ?? '').trim()) out.push(warn(say(who, `action ${index + 1} has no rules text and won't show.`), `${at}actions.${index}.detail`))
  }
}

// A deployable (a drone, mine or turret an item places): a name, and its numbers when it has them.
function checkDeployables(value: unknown, ctx: Context, out: Problem[], base = 'deployables') {
  for (const [index, item] of list(value).entries()) {
    const row = entry(item)
    const at = `${base}.${index}`
    const who = `Deployable ${index + 1}`
    if (typeof row.name !== 'string' || !row.name.trim()) out.push(error(`${who} needs a name.`, `${at}.name`))
    for (const [key, label] of [['size', 'Size'], ['hp', 'HP'], ['evasion', 'Evasion'], ['edef', 'E-defence'], ['armor', 'Armour']] as const) {
      const number = row[key]
      if (number !== undefined && number !== '' && (!isNumber(number) || Number(number) < 0)) out.push(error(`${who}: ${label} needs a number, 0 or more.`, `${at}.${key}`))
    }
    if (row.activation !== undefined && !defIds('activations', true).includes(String(row.activation))) out.push(warn(`${who} has an unknown activation.`, `${at}.activation`))
    checkEntries(row.range, 'range', 'Range', `${at}.range`, who, out)
    checkParts({ actions: row.actions }, `${at}.`, who, ctx, out, false)
  }
}

// The licence an item belongs to: a frame's, at rank 1 to 3. None (GMS, available to everyone) is fine.
function checkLicence(data: Data, ctx: Context, out: Problem[]) {
  const id = String(data.license_id ?? '')
  if (!id) return
  if (ctx.licences && !ctx.licences.has(id)) out.push(error(`Licence "${id}" isn't a frame.`, 'license_id'))
  const rank = data.license_level
  if (!Number.isInteger(rank) || (rank as number) < 1 || (rank as number) > 3) out.push(error('A licence rank is I, II or III.', 'license_level'))
}

const checkPoints = (data: Data, out: Problem[]) => {
  if (data.sp !== undefined && (!Number.isInteger(data.sp) || (data.sp as number) < 0)) out.push(error('System points must be a whole number, 0 or more.', 'sp'))
}

// A profile's or trait's name must be there and differ (whatever the capitals) from the rows before it.
function checkRowName(value: unknown, noun: string, index: number, at: string, seen: Set<string>, out: Problem[]) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) out.push(error(`${noun} ${index + 1} needs a name.`, at))
  else if (seen.has(name.toLowerCase())) out.push(error(`${noun} names must differ: "${name}" is used twice.`, at))
  seen.add(name.toLowerCase())
}

function checkWeapon(data: Data, ctx: Context, out: Problem[]) {
  if (!defIds('weapon_sizes', true).includes(String(data.mount))) out.push(error('Choose the mount size.', 'mount'))
  if (!defIds('weapon_types', true).includes(String(data.type))) out.push(error('Choose the weapon type.', 'type'))
  checkPoints(data, out)
  if (data.no_mods !== undefined && typeof data.no_mods !== 'boolean') out.push(error('Choose whether the weapon takes mods.', 'no_mods'))
  checkLicence(data, ctx, out)
  checkGrants(data, ctx, out)
  const profiles = list(data.profiles)
  // With profiles, each has its own range and damage; the weapon's own tags, rules and actions are shared.
  checkParts(data, '', '', ctx, out, !profiles.length)
  const seen = new Set<string>()
  for (const [index, profile] of profiles.entries()) {
    const row = entry(profile)
    checkRowName(row.name, 'Profile', index, `profiles.${index}.name`, seen, out)
    checkParts(row, `profiles.${index}.`, `Profile ${index + 1}`, ctx, out)
  }
  checkDeployables(data.deployables, ctx, out)
}

function checkSystem(data: Data, ctx: Context, out: Problem[]) {
  if (data.type !== undefined && !defIds('system_types', true).includes(String(data.type))) out.push(error('Choose the kind of system.', 'type'))
  checkPoints(data, out)
  checkLicence(data, ctx, out)
  checkGrants(data, ctx, out)
  checkParts(data, '', '', ctx, out, false)
  checkDeployables(data.deployables, ctx, out)
}

function checkMod(data: Data, ctx: Context, out: Problem[]) {
  checkPoints(data, out)
  checkLicence(data, ctx, out)
  checkGrants(data, ctx, out)
  checkParts(data, '', '', ctx, out, false)
  checkEntries(data.added_range, 'range', 'Added range', 'added_range', '', out)
  checkEntries(data.added_damage, 'damage', 'Added damage', 'added_damage', '', out)
  for (const [index, tag] of list(data.added_tags).entries()) {
    if (!entry(tag).id) out.push(error(`Added tag ${index + 1} needs choosing.`, `added_tags.${index}`))
  }
  checkDeployables(data.deployables, ctx, out)
}

function checkTalent(data: Data, ctx: Context, out: Problem[]) {
  const ranks = list(data.ranks)
  if (ranks.length !== RANK_NAMES.length) out.push(error('A talent has exactly three ranks.', 'ranks'))
  for (const [index, rank] of ranks.entries()) {
    const row = entry(rank)
    const who = `Rank ${RANK_NAMES[index] ?? index + 1}`
    if (typeof row.name !== 'string' || !row.name.trim()) out.push(error(`${who} needs a name.`, `ranks.${index}.name`))
    checkParts(row, `ranks.${index}.`, who, ctx, out, false)
    checkGrants(row, ctx, out, `ranks.${index}.`, who)
  }
}

// The built-in and optional items something grants (a core bonus, talent rank, weapon, system or biomod) must exist;
// replace_integrated is a yes or no.
function checkGrants(data: Data, ctx: Context, out: Problem[], at = '', who = '') {
  for (const key of ['integrated', 'special_equipment'] as const)
    for (const id of list(data[key]))
      if (ctx.known && !ctx.known.has(String(id))) out.push(error(say(who, `Item "${id}" doesn't exist.`), `${at}${key}`))
  if (data.replace_integrated !== undefined && typeof data.replace_integrated !== 'boolean') out.push(error(say(who, 'Replace integrated must be yes or no.'), `${at}replace_integrated`))
}

// What an item needs first (src/rules.ts unmetRequirements): a talent or licence rank, a core bonus or another item.
export const REQUIREMENT_LABELS: Record<(typeof REQUIREMENT_KINDS)[number], string> = { talent: 'Talent', licence: 'Licence', core_bonus: 'Core bonus', commendation: 'Commendation', item: 'Item' }
function checkRequires(data: Data, ctx: Context, out: Problem[]) {
  if (data.requires === undefined) return
  if (!Array.isArray(data.requires)) return void out.push(error('Requirements must be a list.', 'requires'))
  for (const [index, item] of data.requires.entries()) {
    const row = entry(item)
    const n = index + 1, at = `requires.${index}`
    const kind = (REQUIREMENT_KINDS as readonly string[]).includes(String(row.kind)) ? (row.kind as (typeof REQUIREMENT_KINDS)[number]) : undefined
    const id = String(row.id ?? '')
    const known = kind === 'talent' ? ctx.talents : kind === 'licence' ? ctx.licences : kind === 'core_bonus' ? ctx.coreBonuses : kind === 'commendation' ? ctx.commendations : ctx.known
    if (!kind) out.push(error(`Requirement ${n} needs a kind.`, `${at}.kind`))
    else if (!id) out.push(error(`Requirement ${n} needs choosing.`, `${at}.id`))
    else if (known && !known.has(id)) out.push(error(`Requirement ${n}: ${REQUIREMENT_LABELS[kind]} "${id}" doesn't exist.`, `${at}.id`))
    if ((kind === 'talent' || kind === 'licence') && (!Number.isInteger(row.rank) || (row.rank as number) < 1 || (row.rank as number) > 3)) out.push(error(`Requirement ${n} needs a rank, I, II or III.`, `${at}.rank`))
  }
}

// A frame: who made it, its numbers, at least one mount, named traits and a named core system. Written to the same shape
// as lancer-data's frames.json; fields the form has no input for (counters, art) aren't looked at.
function checkFrame(data: Data, ctx: Context, out: Problem[]) {
  if (typeof data.source !== 'string' || !data.source.trim()) out.push(error('Choose a manufacturer.', 'source'))
  const rank = data.license_level
  if (!Number.isInteger(rank) || (rank as number) < 0 || (rank as number) > 3) out.push(error('A licence rank is none (0), I, II or III.', 'license_level'))
  const licence = String(data.license_id ?? '')
  if (data.variant || (licence !== ctx.id && ctx.licences?.has(licence))) {
    if (licence === ctx.id || (data.variant && data.variant === data.name)) out.push(error("A frame can't be an alternate of itself.", 'license_id'))
    else if (ctx.alternates?.has(licence)) out.push(error('Choose the original frame, not another alternate.', 'license_id'))
  }
  else if (licence !== ctx.id) out.push(warn(`Licence ID should be "${ctx.id}".`, 'license_id'))

  // The site's own image field: a path in the image bucket (src/images.ts), never a link.
  if (data.image !== undefined && data.image !== null && data.image !== '' && !IMAGE_PATH.test(String(data.image))) out.push(error('The image must be one uploaded here.', 'image'))

  const stats = entry(data.stats)
  for (const { key, label, unused } of FRAME_STATS) {
    const value = stats[key]
    if (unused && value === undefined) continue
    const field = `stats.${key}`
    if (!isNumber(value)) out.push(error(`${label} needs a number.`, field))
    else if (key === 'size') { if (!defIds('frame_sizes', true).some((id) => Number(id) === Number(value))) out.push(error(`Size is ${orList(defList('frame_sizes', true).map((row) => row.label))}.`, field)) }
    else if (!Number.isInteger(Number(value)) || (Number(value) < 0 && key !== 'tech_attack')) out.push(error(`${label} must be a whole number${key === 'tech_attack' ? '' : ', 0 or more'}.`, field))
  }

  const mounts = list(data.mounts)
  if (!mounts.length) out.push(error('A frame needs at least one weapon mount.', 'mounts'))
  for (const [index, mount] of mounts.entries()) {
    if (!defIds('mount_types', true).includes(String(mount))) out.push(error(`Mount ${index + 1} isn't a known mount.`, `mounts.${index}`))
  }

  const seen = new Set<string>()
  for (const [index, trait] of list(data.traits).entries()) {
    const row = entry(trait)
    checkRowName(row.name, 'Trait', index, `traits.${index}.name`, seen, out)
    checkParts(row, `traits.${index}.`, `Trait ${index + 1}`, ctx, out, false)
    checkDeployables(row.deployables, ctx, out, `traits.${index}.deployables`)
  }

  const core = entry(data.core_system)
  if (typeof core.name !== 'string' || !core.name.trim()) out.push(error('The core system needs a name.', 'core_system.name'))
  // "at" ends in "active_" / "passive_": checkParts adds "actions" / "bonuses", giving core_system.active_actions.0.
  checkParts({ actions: core.active_actions, bonuses: core.active_bonuses }, 'core_system.active_', 'Core power', ctx, out, false)
  checkParts({ actions: core.passive_actions, bonuses: core.passive_bonuses }, 'core_system.passive_', 'Core passive', ctx, out, false)
  if (core.check_bonuses !== undefined) {
    if (!Array.isArray(core.check_bonuses)) out.push(error('Core power checks must be a list.', 'core_system.check_bonuses'))
    else {
      checkParts({ bonuses: core.check_bonuses }, 'core_system.check_', 'Core power check', ctx, out, false)
      // A row with no accuracy is Death's Head's attack bonus (a "val"); the form only makes accuracy rows.
      for (const [index, row] of core.check_bonuses.entries()) {
        const { accuracy, val } = entry(row)
        if (accuracy === undefined ? val === undefined : !Number.isInteger(accuracy) || accuracy === 0) out.push(error(`Core power check ${index + 1} needs +1 or -1 accuracy.`, `core_system.check_bonuses.${index}.accuracy`))
      }
    }
  }
  for (const id of list(core.integrated)) {
    if (ctx.known && !ctx.known.has(String(id))) out.push(error(`Core system: Item "${id}" doesn't exist.`, 'core_system.integrated'))
  }
  checkDeployables(core.deployables, ctx, out, 'core_system.deployables')
}

// A rule's section is from the fixed list, its group from that section's groups, and only the numbers section has numbers.
function checkRule(data: Data, out: Problem[]) {
  const section = SECTIONS.find((s) => s.id === data.section)
  if (!section) out.push(error('Choose a section.', 'section'))
  else {
    if (section.groups && !section.groups.some((g) => g.id === data.group)) out.push(error('Choose a group.', 'group'))
    const numbers = data.numbers
    if (section.shape !== 'numbers' && numbers !== undefined) out.push(error('Only the numbers section has numbers.', 'numbers'))
    if (section.shape === 'numbers') {
      const balance = typeof data.id === 'string' ? numberKeyOf(data.id) : undefined
      const track = data.id === 'rule_numbers_repair_cost' ? { max: 20, count: 1, what: 'Repair cost' } : { max: 99, count: 8, what: 'Overcharge heat' }
      const whole = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max
      if (!Array.isArray(numbers) || !numbers.length) out.push(error('Add at least one number.', 'numbers'))
      else if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n))) out.push(error('Every number needs a value.', 'numbers'))
      // A balance number is one whole number inside its range (the database ignores anything else).
      else if (balance) { if (!(numbers.length === 1 && Number.isInteger(numbers[0]) && numbers[0] >= balance.lo && numbers[0] <= balance.hi)) out.push(error(`${balance.label} must be a whole number from ${balance.lo} to ${balance.hi}.`, 'numbers')) }
      else if (numbers.length > track.count) out.push(error(track.count === 1 ? `${track.what} must be a single number.` : `${track.what} can have at most ${track.count} numbers.`, 'numbers'))
      else if (!numbers.every((n) => whole(n, track.max))) out.push(error(`Numbers must be whole numbers from 0 to ${track.max}.`, 'numbers'))
    }
  }
  if (data.order !== undefined && !(typeof data.order === 'number' && Number.isFinite(data.order))) out.push(error('Order must be a number.', 'order'))
}

function checkManufacturer(data: Data, out: Problem[]) {
  if (typeof data.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(data.id)) out.push(error('Use letters, numbers, - and _, like IPS-N.', 'id'))
  if (!HEX.test(String(data.dark ?? ''))) out.push(error('Main colour needs a hex value like #1c9ae8.', 'dark'))
  if (data.light !== undefined && data.light !== '' && !HEX.test(String(data.light))) out.push(error('Darker colour needs a hex value like #0c4d99.', 'light'))
}

// Everything wrong with one pack item's data. Lists the form has fields for are checked wherever they appear, so the
// raw-data box gets the same checks as the form.
export function validateItem(kind: EditorKind, data: Data, ctx: Context): Problem[] {
  const problems: Problem[] = []
  if (data.id !== ctx.id) problems.push(error(`The ID must stay "${ctx.id}".`, 'id'))
  if (typeof data.name !== 'string' || !data.name.trim()) problems.push(error('A name is needed.', 'name'))
  if (kind === 'pilot_gear' && !defIds('gear_types', true).includes(String(data.type))) problems.push(error('Choose a gear type.', 'type'))
  // Unset means the default price (rules.ts gearPriceDefault).
  if (kind === 'pilot_gear' && data.manna_cost != null && (!Number.isInteger(data.manna_cost) || (data.manna_cost as number) < 0)) problems.push(error('Manna cost must be a whole number, 0 or more.', 'manna_cost'))
  if (kind === 'core_bonuses' && typeof data.source !== 'string') problems.push(error('Choose a manufacturer.', 'source'))

  if (kind === 'weapons') checkWeapon(data, ctx, problems)
  else if (kind === 'systems') checkSystem(data, ctx, problems)
  else if (kind === 'mods') checkMod(data, ctx, problems)
  else if (kind === 'talents') checkTalent(data, ctx, problems)
  else if (kind === 'frames') checkFrame(data, ctx, problems)
  else if (kind === 'manufacturers') checkManufacturer(data, problems)
  else if (kind === 'rules') checkRule(data, problems)
  else checkParts(data, '', '', ctx, problems)
  if (kind === 'pilot_gear') checkDeployables(data.deployables, ctx, problems)
  if (kind === 'core_bonuses' || kind === 'pilot_gear') checkGrants(data, ctx, problems)
  if (['weapons', 'systems', 'mods', 'pilot_gear', 'core_bonuses', 'talents', 'frames'].includes(kind)) checkRequires(data, ctx, problems)
  return problems
}

// Where on the body a biomod goes: the form suggests these (and any slot already used); the slot itself is free text.
export const BIONIC_SLOTS = ['Head', 'Eyes', 'Ears', 'Brain', 'Spine', 'Torso', 'Heart', 'Lungs', 'Arm', 'Hand', 'Leg', 'Foot', 'Skin', 'Nervous system', 'Full body']
// A biomod has the same fields the other kinds have, in columns of the bionics table: effect_bonuses (any bonus id,
// personal stats included), actions, integrated, special_equipment, replace_integrated and requires.
export function validateBionic(data: Data, ctx: Pick<Context, 'statIds'> & Partial<Context>): Problem[] {
  const problems: Problem[] = []
  const full: Context = { id: '', tags: new Map(), ...ctx }
  checkParts({ bonuses: data.effect_bonuses }, 'effect_', '', full, problems, false)
  checkParts({ actions: data.actions }, '', '', full, problems, false)
  checkGrants(data, full, problems)
  checkRequires(data, full, problems)
  if (typeof data.name !== 'string' || !data.name.trim()) problems.push(error('A name is needed.', 'name'))
  if (typeof data.slot !== 'string' || !data.slot.trim()) problems.push(warn('No slot set.', 'slot'))
  if (typeof data.source !== 'string' || !data.source.trim()) problems.push(warn("No manufacturer. It's listed under Other.", 'source'))
  if (!Number.isInteger(data.manna_cost) || (data.manna_cost as number) < 0) problems.push(error('Price must be a whole number, 0 or more.', 'manna_cost'))
  if (!Number.isInteger(data.mod_point_cost) || (data.mod_point_cost as number) < 0) problems.push(error('Mod points must be a whole number, 0 or more.', 'mod_point_cost'))
  return problems
}

// A faction (the reputation tracker's organisation) needs a name no other faction has, whatever the capitals.
export function validateFaction(name: string, others: string[]): Problem[] {
  if (!name.trim()) return [error('A name is needed.', 'name')]
  return others.some((other) => sameName(other, name)) ? [error('Another faction already has that name.', 'name')] : []
}

// A commendation (an award GMs give pilots): a unique name, a short description and an icon from the site's set.
export const COMMENDATION_NAME_MAX = 60
export const COMMENDATION_DESCRIPTION_MAX = 300
export function validateCommendation(name: string, description: string, icon: string, others: string[], icons: string[]): Problem[] {
  const problems: Problem[] = []
  if (!name.trim()) problems.push(error('A name is needed.', 'name'))
  else if (name.trim().length > COMMENDATION_NAME_MAX) problems.push(error(`A name is at most ${COMMENDATION_NAME_MAX} characters.`, 'name'))
  else if (others.some((other) => sameName(other, name))) problems.push(error('Another commendation already has that name.', 'name'))
  if (description.length > COMMENDATION_DESCRIPTION_MAX) problems.push(error(`A description is at most ${COMMENDATION_DESCRIPTION_MAX} characters.`, 'description'))
  if (!icons.includes(icon)) problems.push(error('Pick an icon.', 'icon'))
  return problems
}

// The same checks for any kind, as the editor calls them.
export function problemsFor(kind: EditorKind, data: Data, ctx: Context): Problem[] {
  const name = String(data.name ?? '')
  if (kind === 'factions') return validateFaction(name, ctx.others ?? [])
  if (kind === 'commendations') return validateCommendation(name, String(data.description ?? ''), String(data.icon ?? ''), ctx.others ?? [], ICON_CHOICES)
  return kind === 'bionics' ? validateBionic(data, ctx) : validateItem(kind, data, ctx)
}

// A weapon with one set of numbers becomes one with profiles: its range, damage and on-hit text go into the first
// profile (the weapon's own tags, rules and actions stay shared), and a second, empty one is added. And back: when one
// profile is left, its fields move up into the weapon again.
const PER_PROFILE = ['range', 'damage', 'on_attack', 'on_hit', 'on_crit']
export function splitProfiles(data: Data): Data {
  const first: Data = { name: 'Standard', range: [], damage: [] }
  const rest: Data = { ...data }
  for (const key of PER_PROFILE) {
    if (key in rest) first[key] = rest[key]
    delete rest[key]
  }
  return { ...rest, profiles: [first, { name: 'Mode 2', range: [], damage: [] }] }
}
export function setProfiles(data: Data, profiles: Data[]): Data {
  if (profiles.length !== 1) return { ...data, profiles }
  const { name: _name, ...own } = profiles[0]
  const { profiles: _profiles, ...rest } = data
  return { ...rest, ...own }
}
