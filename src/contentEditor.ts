import { capitalise } from './text'
import { bonusValue } from './bonuses'
import { flatDamage } from './damage'
import { IMAGE_PATH } from './images'
import type { LcpKind } from './lcp'
import { EXOTIC, EXOTIC_TAG } from './rules'

// The content editor's rules (ContentEditorView.vue): the kinds it edits, new ids, and what makes an item's data
// acceptable to save. Pure, so it's tested without a database (src/contentEditor.test.ts).

// The one pack every new item goes in, made the first time an owner makes one.
export const HOMEBREW_PACK = 'Campaign homebrew'

// The "site" kinds (bionics, factions) aren't pack content: they're rows in their own tables. "form": has a form
// here; the other kinds are edited through the raw-data box (still with the live preview). "prefix" starts a new id.
export type EditorKind = LcpKind | 'bionics' | 'factions' | 'commendations'
export type KindInfo = { key: EditorKind; label: string; singular: string; icon: string; prefix: string; site: boolean; form: boolean }
const kind = (key: EditorKind, label: string, singular: string, icon: string, prefix: string, form = false, site = false): KindInfo =>
  ({ key, label, singular, icon, prefix, form, site })
export const KINDS: KindInfo[] = [
  kind('frames', 'Frames', 'frame', 'frame', 'hb_mf_', true),
  kind('weapons', 'Weapons', 'weapon', 'weapon', 'hb_mw_', true),
  kind('systems', 'Systems', 'system', 'system', 'hb_ms_', true),
  kind('mods', 'Weapon mods', 'weapon mod', 'mod', 'hb_wm_', true),
  kind('pilot_gear', 'Pilot gear', 'pilot gear', 'pilot', 'hb_pg_', true),
  kind('talents', 'Talents', 'talent', 'talent', 'hb_t_', true),
  kind('core_bonuses', 'Core bonuses', 'core bonus', 'corebonus', 'hb_cb_', true),
  kind('tags', 'Tags', 'tag', 'flag', 'hb_tg_', true),
  kind('manufacturers', 'Manufacturers', 'manufacturer', 'manufacturer', 'hb_mfr_', true),
  kind('bionics', 'Biomods', 'biomod', 'mod', '', true, true),
  kind('factions', 'Factions', 'faction', 'manufacturer', '', true, true),
  kind('commendations', 'Commendations', 'commendation', 'medal', '', true, true),
]
export const kindInfo = (key: EditorKind) => KINDS.find((k) => k.key === key)!

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
  if (kind === 'bionics') return { id: '', name: '', description: '', slot: '', source: '', effect: '', manna_cost: 500, mod_point_cost: 1, retired: false, bonuses: [] }
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

// What the form's pickers offer, and what validation accepts.
export const GEAR_TYPES = ['Armor', 'Weapon', 'Gear']
export const DAMAGE_TYPES = ['Kinetic', 'Energy', 'Explosive', 'Burn', 'Heat', 'Variable']
export const RANGE_TYPES = ['Range', 'Threat', 'Line', 'Cone', 'Blast', 'Burst']
// Weapon and system choices. The data also has a few values the form doesn't offer (a ship-class mount, a "Special" type):
// they're accepted, and a form showing one keeps it.
export const WEAPON_MOUNTS = ['Auxiliary', 'Main', 'Heavy', 'Superheavy']
export const WEAPON_TYPES = ['Rifle', 'Cannon', 'CQB', 'Launcher', 'Melee', 'Nexus']
const DATA_ONLY_MOUNTS = ['Ship-class']
const DATA_ONLY_WEAPON_TYPES = ['Special', 'Spool Weapon', '???']
export const SYSTEM_TYPES = ['System', 'AI', 'Shield', 'Deployable', 'Drone', 'Tech', 'Armor', 'Flight System', 'Integrated']
export const DEPLOYABLE_TYPES = ['Deployable', 'Drone', 'Mine']
export const RANK_NAMES = ['I', 'II', 'III']
export const HEX = /^#[0-9a-f]{6}$/i
export const ACTIVATIONS = ['Quick', 'Full', 'Reaction', 'Protocol', 'Free', 'Quick Tech', 'Full Tech', 'Invade', 'Overcharge']

// The bonus ids the site's build maths counts (src/gameData.ts pilotVitals and sheetStats, src/mechData.ts
// mechEffects): pilot gear's, personal stats (from the pilot_stats table, see personalBonusTypes) and the mech's own.
// Anything else (bonuses aimed at one weapon type, say) is only reached through the raw-data box and isn't counted.
export type BonusType = { id: string; label: string; group: 'Pilot' | 'Personal stat' | 'Mech' }
const bonus = (group: BonusType['group'], id: string, label: string): BonusType => ({ group, id, label })
export const BONUS_TYPES: BonusType[] = [
  bonus('Pilot', 'pilot_hp', 'Pilot HP'), bonus('Pilot', 'pilot_armor', 'Pilot armour'),
  bonus('Pilot', 'pilot_speed', 'Pilot speed'), bonus('Pilot', 'pilot_edef', 'Pilot E-defence'),
  bonus('Mech', 'structure', 'Structure'), bonus('Mech', 'stress', 'Stress'), bonus('Mech', 'hp', 'HP'),
  bonus('Mech', 'heatcap', 'Heat cap'), bonus('Mech', 'armor', 'Armour'), bonus('Mech', 'armor_max', 'Armour maximum'),
  bonus('Mech', 'evasion', 'Evasion'), bonus('Mech', 'speed', 'Speed'), bonus('Mech', 'edef', 'E-defence'),
  bonus('Mech', 'tech_attack', 'Tech attack'), bonus('Mech', 'repcap', 'Repair cap'), bonus('Mech', 'sp', 'System points'),
  bonus('Mech', 'size', 'Size'), bonus('Mech', 'ai_cap', 'AI capacity'), bonus('Mech', 'limited_bonus', 'Limited uses'),
]
export const personalBonusTypes = (stats: { id: string; name: string }[]): BonusType[] =>
  stats.map((stat) => bonus('Personal stat', stat.id, stat.name))
// Pilot gear can only change the pilot; a core bonus any of them.
export const bonusTypesFor = (kind: EditorKind, stats: { id: string; name: string }[]) =>
  [...BONUS_TYPES.filter((type) => kind !== 'pilot_gear' || type.group === 'Pilot'), ...(kind === 'pilot_gear' || kind === 'core_bonuses' ? personalBonusTypes(stats) : [])]

// The frame form's choices (src/components/editor/FrameForm.vue). A frame is its own licence: license_id is its id, unless it
// is an alternate of another frame (an alternate Genghis), when license_id is the original's id and variant its name
// (alternateOf() in mechData.ts reads it); license_level (0 for GMS, otherwise 2) is the rank that unlocks it. "unused" stats are game data the site's mech maths
// leaves out (no grit, save target or sensors); the form still edits them.
export const FRAME_ROLES = ['Balanced', 'Striker', 'Defender', 'Support', 'Controller', 'Artillery']
export const FRAME_MOUNTS = ['Main', 'Heavy', 'Flex', 'Main/Aux', 'Aux/Aux', 'Auxiliary', 'Integrated Auxiliary']
export const FRAME_USES = ['Turn', 'Next Turn', 'Round', 'Next Round', 'Scene', 'Encounter', 'Mission', 'Free']
export const FRAME_SIZES = [0.5, 1, 2, 3]
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
  // The frames that are themselves alternates of another (an alternate can't be of one of these).
  alternates?: Set<string>
}

const isNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const entry = (value: unknown): Data => (isObject(value) ? value : {})
// "Profile 1: range 1 needs a type." inside a part of the item, "Range 1 needs a type." at the top.
const say = (who: string, text: string) => (who ? `${who}: ${capitalise(text)}` : capitalise(text))

// A list of range or damage entries: a type and a number (damage may be dice).
function checkEntries(value: unknown, noun: 'range' | 'damage', label: string, at: string, who: string, out: Problem[]) {
  const types = noun === 'range' ? RANGE_TYPES : DAMAGE_TYPES
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

  const known = new Set([...BONUS_TYPES.map((type) => type.id), ...ctx.statIds])
  for (const [index, bonus] of list(data.bonuses).entries()) {
    const row = entry(bonus)
    const id = String(row.id ?? '')
    if (!id) out.push(error(say(who, `bonus ${index + 1} needs a type.`), `${at}bonuses.${index}.id`))
    else if (!known.has(id)) out.push(warn(say(who, `Bonus "${id}" isn't counted in the stats.`), `${at}bonuses.${index}.id`))
    // A bonus the build maths doesn't count (an accuracy bonus has no "val") is kept as it is, not evaluated.
    if (known.has(id) && bonusValue(row.val, FORMULA_VARIABLES) === null) out.push(error(say(who, `bonus ${index + 1} needs a number, or a formula such as {systems}/2.`), `${at}bonuses.${index}.val`))
  }

  if (numbers) {
    checkEntries(data.range, 'range', 'Range', `${at}range`, who, out)
    checkEntries(data.damage, 'damage', 'Damage', `${at}damage`, who, out)
  }
  for (const [index, action] of list(data.actions).entries()) {
    const row = entry(action)
    if (typeof row.name !== 'string' || !row.name.trim()) out.push(error(say(who, `action ${index + 1} needs a name.`), `${at}actions.${index}.name`))
    if (row.activation !== undefined && !ACTIVATIONS.includes(String(row.activation))) out.push(warn(say(who, `action ${index + 1} has an unknown activation.`), `${at}actions.${index}.activation`))
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

function checkWeapon(data: Data, ctx: Context, out: Problem[]) {
  if (!WEAPON_MOUNTS.concat(DATA_ONLY_MOUNTS).includes(String(data.mount))) out.push(error('Choose the mount size.', 'mount'))
  if (!WEAPON_TYPES.concat(DATA_ONLY_WEAPON_TYPES).includes(String(data.type))) out.push(error('Choose the weapon type.', 'type'))
  checkPoints(data, out)
  checkLicence(data, ctx, out)
  const profiles = list(data.profiles)
  // With profiles, each has its own range and damage; the weapon's own tags, rules and actions are shared.
  checkParts(data, '', '', ctx, out, !profiles.length)
  const seen = new Set<string>()
  for (const [index, profile] of profiles.entries()) {
    const row = entry(profile)
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) out.push(error(`Profile ${index + 1} needs a name.`, `profiles.${index}.name`))
    else if (seen.has(name.toLowerCase())) out.push(error(`Profile names must differ: "${name}" is used twice.`, `profiles.${index}.name`))
    seen.add(name.toLowerCase())
    checkParts(row, `profiles.${index}.`, `Profile ${index + 1}`, ctx, out)
  }
  checkDeployables(data.deployables, ctx, out)
}

function checkSystem(data: Data, ctx: Context, out: Problem[]) {
  if (data.type !== undefined && !SYSTEM_TYPES.includes(String(data.type))) out.push(error('Choose the kind of system.', 'type'))
  checkPoints(data, out)
  checkLicence(data, ctx, out)
  checkParts(data, '', '', ctx, out, false)
  checkDeployables(data.deployables, ctx, out)
}

function checkMod(data: Data, ctx: Context, out: Problem[]) {
  checkPoints(data, out)
  checkLicence(data, ctx, out)
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
    for (const key of ['integrated', 'special_equipment'] as const) {
      for (const id of list(row[key])) {
        if (ctx.known && !ctx.known.has(String(id))) out.push(error(`${who}: Item "${id}" doesn't exist.`, `ranks.${index}.${key}`))
      }
    }
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
    else if (key === 'size') { if (!FRAME_SIZES.includes(Number(value))) out.push(error('Size is ½, 1, 2 or 3.', field)) }
    else if (!Number.isInteger(Number(value)) || (Number(value) < 0 && key !== 'tech_attack')) out.push(error(`${label} must be a whole number${key === 'tech_attack' ? '' : ', 0 or more'}.`, field))
  }

  const mounts = list(data.mounts)
  if (!mounts.length) out.push(error('A frame needs at least one weapon mount.', 'mounts'))
  for (const [index, mount] of mounts.entries()) {
    if (!FRAME_MOUNTS.includes(String(mount))) out.push(error(`Mount ${index + 1} isn't a known mount.`, `mounts.${index}`))
  }

  const seen = new Set<string>()
  for (const [index, trait] of list(data.traits).entries()) {
    const row = entry(trait)
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) out.push(error(`Trait ${index + 1} needs a name.`, `traits.${index}.name`))
    else if (seen.has(name.toLowerCase())) out.push(error(`Trait names must differ: "${name}" is used twice.`, `traits.${index}.name`))
    seen.add(name.toLowerCase())
    checkParts(row, `traits.${index}.`, `Trait ${index + 1}`, ctx, out, false)
    checkDeployables(row.deployables, ctx, out, `traits.${index}.deployables`)
  }

  const core = entry(data.core_system)
  if (typeof core.name !== 'string' || !core.name.trim()) out.push(error('The core system needs a name.', 'core_system.name'))
  // "at" ends in "active_" / "passive_": checkParts adds "actions" / "bonuses", giving core_system.active_actions.0.
  checkParts({ actions: core.active_actions, bonuses: core.active_bonuses }, 'core_system.active_', 'Core power', ctx, out, false)
  checkParts({ actions: core.passive_actions, bonuses: core.passive_bonuses }, 'core_system.passive_', 'Core passive', ctx, out, false)
  for (const id of list(core.integrated)) {
    if (ctx.known && !ctx.known.has(String(id))) out.push(error(`Core system: Item "${id}" doesn't exist.`, 'core_system.integrated'))
  }
  checkDeployables(core.deployables, ctx, out, 'core_system.deployables')
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
  if (kind === 'pilot_gear' && !GEAR_TYPES.includes(String(data.type))) problems.push(error('Choose a gear type.', 'type'))
  // Unset means the default price (rules.ts GEAR_PRICE_DEFAULT).
  if (kind === 'pilot_gear' && data.manna_cost != null && (!Number.isInteger(data.manna_cost) || (data.manna_cost as number) < 0)) problems.push(error('Manna cost must be a whole number, 0 or more.', 'manna_cost'))
  if (kind === 'core_bonuses' && typeof data.source !== 'string') problems.push(error('Choose a manufacturer.', 'source'))

  if (kind === 'weapons') checkWeapon(data, ctx, problems)
  else if (kind === 'systems') checkSystem(data, ctx, problems)
  else if (kind === 'mods') checkMod(data, ctx, problems)
  else if (kind === 'talents') checkTalent(data, ctx, problems)
  else if (kind === 'frames') checkFrame(data, ctx, problems)
  else if (kind === 'manufacturers') checkManufacturer(data, problems)
  else checkParts(data, '', '', ctx, problems)
  return problems
}

// Where on the body a biomod goes: the form suggests these (and any slot already used); the slot itself is free text.
export const BIONIC_SLOTS = ['Head', 'Eyes', 'Ears', 'Brain', 'Spine', 'Torso', 'Heart', 'Lungs', 'Arm', 'Hand', 'Leg', 'Foot', 'Skin', 'Nervous system', 'Full body']
export type BionicData = { id: string; name: string; description: string; slot: string; source: string; effect: string; manna_cost: number; mod_point_cost: number; retired: boolean; bonuses: { stat_id: string; amount: number }[] }
export function validateBionic(data: Data, ctx: Pick<Context, 'statIds'>): Problem[] {
  const problems: Problem[] = []
  if (typeof data.name !== 'string' || !data.name.trim()) problems.push(error('A name is needed.', 'name'))
  if (typeof data.slot !== 'string' || !data.slot.trim()) problems.push(warn('No slot set.', 'slot'))
  if (typeof data.source !== 'string' || !data.source.trim()) problems.push(warn("No manufacturer. It's listed under Other.", 'source'))
  if (!Number.isInteger(data.manna_cost) || (data.manna_cost as number) < 0) problems.push(error('Price must be a whole number, 0 or more.', 'manna_cost'))
  if (!Number.isInteger(data.mod_point_cost) || (data.mod_point_cost as number) < 0) problems.push(error('Mod points must be a whole number, 0 or more.', 'mod_point_cost'))
  const seen = new Set<string>()
  for (const [index, bonus] of list(data.bonuses).entries()) {
    const row = entry(bonus)
    const stat = String(row.stat_id ?? '')
    if (!ctx.statIds.includes(stat)) problems.push(error(`Bonus ${index + 1} needs a stat that exists.`, `bonuses.${index}.stat_id`))
    else if (seen.has(stat)) problems.push(error(`Only one bonus per stat: ${stat} is there twice.`, `bonuses.${index}.stat_id`))
    seen.add(stat)
    if (!Number.isInteger(row.amount) || row.amount === 0) problems.push(error(`Bonus ${index + 1} must be a whole number, not 0.`, `bonuses.${index}.amount`))
  }
  return problems
}

// A faction (the reputation tracker's organisation) needs a name no other faction has, whatever the capitals.
export function validateFaction(name: string, others: string[]): Problem[] {
  const key = (text: string) => text.trim().toLowerCase()
  if (!name.trim()) return [error('A name is needed.', 'name')]
  return others.some((other) => key(other) === key(name)) ? [error('Another faction already has that name.', 'name')] : []
}

// A commendation (an award GMs give pilots): a unique name, a short description and an icon from the site's set.
export const COMMENDATION_NAME_MAX = 60
export const COMMENDATION_DESCRIPTION_MAX = 300
export function validateCommendation(name: string, description: string, icon: string, others: string[], icons: string[]): Problem[] {
  const key = (text: string) => text.trim().toLowerCase()
  const problems: Problem[] = []
  if (!name.trim()) problems.push(error('A name is needed.', 'name'))
  else if (name.trim().length > COMMENDATION_NAME_MAX) problems.push(error(`A name is at most ${COMMENDATION_NAME_MAX} characters.`, 'name'))
  else if (others.some((other) => key(other) === key(name))) problems.push(error('Another commendation already has that name.', 'name'))
  if (description.length > COMMENDATION_DESCRIPTION_MAX) problems.push(error(`A description is at most ${COMMENDATION_DESCRIPTION_MAX} characters.`, 'description'))
  if (!icons.includes(icon)) problems.push(error('Pick an icon.', 'icon'))
  return problems
}

// The same checks for any kind, as the editor calls them.
export function problemsFor(kind: EditorKind, data: Data, ctx: Context): Problem[] {
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
