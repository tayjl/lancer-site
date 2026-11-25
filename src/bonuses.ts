import { shallowRef } from 'vue'
import type { Bonus } from './gameData'
import { plural } from './text'

// Imported formulas are data, never JavaScript. Only arithmetic and known build variables are allowed.
export function bonusValue(value: unknown, variables: Record<string, number> = {}): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.length > 250) return null
  const text = value.replace(/\{([a-z_]+)\}/gi, (_, key: string) => Object.hasOwn(variables, key.toLowerCase()) ? String(variables[key.toLowerCase()]) : '?').replace(/\s/g, '')
  const tokens = text.match(/\d+(?:\.\d+)?|[()+*/%-]|[a-z]+|,/gi) ?? []
  if (tokens.join('') !== text || tokens.length > 100) return null
  let at = 0
  function atom(): number {
    const token = tokens[at++]
    if (token === '-') return -atom()
    if (token === '+') return atom()
    if (token === '(') { const result = expression(); if (tokens[at++] !== ')') throw Error(); return result }
    if (token && /^(floor|ceil|round|min|max)$/i.test(token)) {
      if (tokens[at++] !== '(') throw Error()
      const args = [expression()]
      while (tokens[at] === ',') { at++; args.push(expression()) }
      if (tokens[at++] !== ')') throw Error()
      if (['floor', 'ceil', 'round'].includes(token.toLowerCase()) && args.length !== 1) throw Error()
      const functions: Record<string, (...values: number[]) => number> = { floor: value => Math.floor(value), ceil: value => Math.ceil(value), round: value => Math.round(value), min: Math.min, max: Math.max }
      return functions[token.toLowerCase()](...args)
    }
    if (!token || !/^\d+(\.\d+)?$/.test(token)) throw Error()
    return Number(token)
  }
  function product(): number {
    let result = atom()
    while (['*', '/', '%'].includes(tokens[at])) {
      const operator = tokens[at++], next = atom()
      result = operator === '*' ? result * next : operator === '/' ? result / next : result % next
    }
    return result
  }
  function expression(): number {
    let result = product()
    while (tokens[at] === '+' || tokens[at] === '-') { const operator = tokens[at++], next = product(); result += operator === '+' ? next : -next }
    return result
  }
  try { const result = expression(); return at === tokens.length && Number.isFinite(result) ? result : null } catch { return null }
}

// "key" is the stable id of where it came from (an item, core bonus or frame id), for choices a bonus asks the player to make.
export type NamedBonus = { source: string; bonus: Bonus; key?: string }
// Every effect type, declared once: the editor's picker and validation, the sheet maths and isPilotBonus all read this.
// "value" is what the form asks for: a number or formula (a stat), nothing, a number, a whole number (0 or more), a mount type,
// four overcharge steps or a list of tags. "counted": 'stat' is a mech stat (its "stat" key, added or set through
// resolveBonuses), 'pilot' is counted on the pilot's sheet, 'effect' is read by its own code (src/mechData.ts). "filters": the
// optional lists that aim it at some weapons; "max": add_mount's optional "only if fewer than N mounts"; "damageType": a damage
// bonus's optional damage_type; "hidden": counted but not offered in the picker. A new mechanic is one entry here.
export type BonusFilter = 'weapon_types' | 'weapon_sizes' | 'range_types' | 'damage_types'
export type BonusGroup = 'Mech stats' | 'Pilot stats' | 'Personal stats' | 'Mounts' | 'Weapons' | 'Resources' | 'Drones & deployables'
export type BonusDef = {
  id: string; label: string; group: BonusGroup; scope: 'pilot' | 'mech'
  value: 'formula' | 'none' | 'number' | 'whole' | 'mount' | 'steps' | 'tags' | 'talent'
  counted: 'stat' | 'pilot' | 'effect'; stat?: string
  filters?: BonusFilter[]; max?: boolean; damageType?: boolean; hidden?: boolean
}
export const BONUS_GROUPS: BonusGroup[] = ['Mech stats', 'Pilot stats', 'Personal stats', 'Mounts', 'Weapons', 'Resources', 'Drones & deployables']
const mechStat = (id: string, label: string, stat?: string, hidden?: boolean): BonusDef => ({ id, label, group: 'Mech stats', scope: 'mech', value: 'formula', counted: 'stat', stat: stat ?? id, ...(hidden ? { hidden } : {}) })
const pilotStat = (id: string, label: string): BonusDef => ({ id, label, group: 'Pilot stats', scope: 'pilot', value: 'formula', counted: 'pilot' })
const effect = (group: BonusGroup, id: string, label: string, value: BonusDef['value'], more: Partial<BonusDef> = {}): BonusDef => ({ id, label, group, scope: 'mech', value, counted: 'effect', ...more })
const WEAPON_FILTERS: BonusFilter[] = ['weapon_types', 'weapon_sizes', 'range_types', 'damage_types']
export const BONUS_REGISTRY: BonusDef[] = [
  mechStat('structure', 'Structure'), mechStat('stress', 'Stress'), mechStat('hp', 'HP'), mechStat('heatcap', 'Heat cap', 'heat'),
  mechStat('armor', 'Armour', 'armour'), mechStat('armor_max', 'Armour maximum'), mechStat('evasion', 'Evasion'), mechStat('speed', 'Speed'),
  mechStat('edef', 'E-defence'), mechStat('tech_attack', 'Tech attack'), mechStat('repcap', 'Repair cap', 'repair'),
  mechStat('sp', 'System points', 'system_points'), mechStat('size', 'Size'), mechStat('ai_cap', 'AI capacity'), mechStat('limited_bonus', 'Limited uses'),
  mechStat('heat_cap', 'Heat cap', 'heat', true),
  pilotStat('pilot_hp', 'Pilot HP'), pilotStat('pilot_armor', 'Pilot armour'), pilotStat('pilot_speed', 'Pilot speed'),
  pilotStat('pilot_edef', 'Pilot E-defence'), pilotStat('mod_points', 'Mod points'),
  { id: 'talent_rank', label: 'Talent ranks', group: 'Pilot stats', scope: 'pilot', value: 'talent', counted: 'effect' },
  effect('Mounts', 'add_mount', 'Adds a mount', 'mount', { max: true }),
  effect('Mounts', 'replace_mount', 'Replaces a mount', 'mount'),
  effect('Mounts', 'superheavy_mounting', 'Superheavy mount', 'none'),
  effect('Weapons', 'range', 'Weapon range', 'number', { filters: WEAPON_FILTERS }),
  effect('Weapons', 'threat', 'Weapon threat', 'number', { filters: WEAPON_FILTERS }),
  effect('Weapons', 'damage', 'Weapon damage', 'number', { filters: WEAPON_FILTERS, damageType: true }),
  effect('Weapons', 'add_tags', 'Adds tags to weapons', 'tags', { filters: WEAPON_FILTERS }),
  effect('Resources', 'cheap_struct', 'Structure repair cost', 'whole'),
  effect('Resources', 'overcharge', 'Overcharge heat', 'steps'),
  ...['Drone', 'Deployable'].flatMap((who) => ['hp:HP', 'armor:armour', 'evasion:evasion', 'edef:E-defence', 'size:size', 'speed:speed', 'heatcap:Heat cap'].map((entry) => {
    const [key, label] = entry.split(':')
    return effect('Drones & deployables', `${who.toLowerCase()}_${key}`, `${who} ${label}`, 'number')
  })),
  // An accuracy bonus on attacks: listed where the checks are (mechResources), so never a "not counted" reminder.
  effect('Weapons', 'attack', 'Attack', 'none', { hidden: true }),
]
const byId = new Map(BONUS_REGISTRY.map((def) => [def.id, def]))
export const bonusDef = (id: string) => byId.get(id)
// A personal stat (the pilot_stats table) needs no code: it's counted on the pilot's sheet.
export const personalDef = (stat: { id: string; name: string }): BonusDef => ({ id: stat.id, label: stat.name, group: 'Personal stats', scope: 'pilot', value: 'formula', counted: 'pilot' })
// "Adds 2 to Speed", "Sets Speed to 2", "Adds a mount: Main". An id nobody declared is named by its id.
export function bonusSummary(bonus: { id?: unknown; val?: unknown; replace?: unknown; talent?: unknown }, def: BonusDef | undefined = bonusDef(String(bonus.id))) {
  const name = def?.label ?? String(bonus.id ?? '').replaceAll('_', ' ')
  const val = Array.isArray(bonus.val) ? bonus.val.map((part) => (typeof part === 'object' && part ? String((part as { id?: unknown }).id ?? '') : String(part))).join(', ') : bonus.val === undefined ? '' : String(bonus.val)
  if (bonus.id === 'talent_rank') { const talent = String(bonus.talent ?? ''); return `Gives ${plural(Number(val), 'rank')} of ${talentNames.value.get(talent) ?? talent}` }
  if (!val || def?.value === 'none') return name
  if (def && def.value !== 'formula') return `${name}: ${val}`
  if (bonus.replace) return `Sets ${name} to ${val}`
  const number = Number(val)
  return Number.isFinite(number) && number < 0 ? `Takes ${-number} from ${name}` : `Adds ${val} to ${name}`
}

// The personal stat ids (the pilot_stats table, set by gameData.ts loadPilotStats) and pilot-only ids: counted on the pilot, never on the mech.
export const personalStatIds = shallowRef(new Set<string>())
// Talent id to name (set by gameData.ts with the talents), for the summary of a talent_rank bonus.
export const talentNames = shallowRef(new Map<string, string>())
export const isPilotBonus = (id: string) => id.startsWith('pilot_') || bonusDef(id)?.scope === 'pilot' || personalStatIds.value.has(id)
// "+10 hp, only when exposed." A minimum or a set value reads as what it means: "Threat range is at least 3.", "Sets speed to 4."
// Bonus ids and {braces} are data, not wording.
export function bonusReminder(bonus: Bonus, value: number | null) {
  const name = String(bonus.id ?? 'unknown bonus').replaceAll('_', ' ')
  const types = Array.isArray(bonus.range_types) ? bonus.range_types.map(String) : []
  // It applies to each listed type: "Threat range is at least 3.", "Threat and Range are at least 2."
  const minimum = types.length > 1 ? `${types.join(' and ')}${types.includes('Range') ? ' are' : ' ranges are'}` : `${types[0] && types[0] !== 'Range' ? `${types[0]} range` : 'Range'} is`
  const what = value === null ? name
    : bonus.id === 'min_range' ? `${minimum} at least ${value}`
    : bonus.replace ? `Sets ${name} to ${value}`
    : `${value >= 0 ? '+' : ''}${value} ${name}`
  const when = bonus.condition ? `, only when ${String(bonus.condition).replace(/[{}]/g, '')}` : ''
  return `${what}${when}.${bonus.detail ? ` ${bonus.detail}` : ''}`
}
// A conditional bonus in a stat's or weapon's "where this comes from" lines: named, never counted.
export const uncountedLine = (source: string, bonus: Bonus, variables: Record<string, number> = {}) => `${source}: ${bonusReminder(bonus, bonusValue(bonus.val, variables))} Not counted.`
export function permanentBonus(bonus: Bonus) {
  return !bonus.condition && !bonus.detail && !['damage_types', 'range_types', 'weapon_types', 'weapon_sizes'].some(key => Array.isArray(bonus[key]) && (bonus[key] as unknown[]).length)
}

export function resolveBonuses(base: number, entries: { source: string; value: number; replace?: boolean; overwrite?: boolean }[]) {
  const highest = (list: typeof entries) => list.reduce<typeof entries[number] | undefined>((best, entry) => !best || entry.value > best.value ? entry : best, undefined)
  const fixed = highest(entries.filter(entry => entry.replace && entry.overwrite))
  const replacement = entries.filter(entry => entry.replace && !entry.overwrite)
  const override = highest(entries.filter(entry => entry.overwrite && !entry.replace))
  const additive = override ? [override] : entries.filter(entry => !entry.replace && !entry.overwrite)
  return {
    value: fixed ? fixed.value : (replacement.length ? replacement.reduce((sum, entry) => sum + entry.value, 0) : base) + additive.reduce((sum, entry) => sum + entry.value, 0),
    used: fixed ? [fixed] : [...replacement, ...additive],
    usesBase: !fixed && !replacement.length,
  }
}
