import { computed, shallowRef, watch } from 'vue'
import { cached, clearCatalogues, loadKind, reloads } from './catalogue'
import { BASE_ACTIONS, baseActions, toBaseAction, type BaseAction } from './baseActions'
import { rule, ruleItems, toRuleItem } from './rulesData'
import { loadDefinitions } from './definitions'
import { fetchAll, supabase } from './lib/supabaseClient'
import type { Sheet } from './myPilot'
import hpIcon from './assets/icons/hp.svg'
import armourIcon from './assets/icons/armour.svg'
import speedIcon from './assets/icons/speed.svg'
import eDefIcon from './assets/icons/e_def.svg'
import physicalityIcon from './assets/icons/physicality.svg'
import dexterityIcon from './assets/icons/dexterity.svg'
import perceptionIcon from './assets/icons/perception.svg'
import acuityIcon from './assets/icons/acuity.svg'
import techFluencyIcon from './assets/icons/techfluency.svg'
import hullIcon from './assets/icons/hull.svg'
import agilityIcon from './assets/icons/agility.svg'
import systemsIcon from './assets/icons/systems.svg'
import engineeringIcon from './assets/icons/engineering.svg'
import { flatDamageText } from './damage'
import { bonusValue, permanentBonus, personalStatIds, resolveBonuses, talentNames, uncountedLine, type NamedBonus } from './bonuses'

// The catalogues the pilot sheet picks from: pilot gear (from the imported LANCER packs), the site's own
// bionics, and the custom pilot stats. Characters only store ids; names and details come from here.
// The mech page's catalogues (frames, mech weapons, systems) are in src/mechData.ts.

// A LANCER item (pilot gear, mech weapon or system) as lancer-data has it, cut down to what the site shows.
// "type" is pilot gear's Armor/Weapon/Gear, a weapon's type (Rifle...) or a system's (AI...). "mount" is a
// mech weapon's size (Auxiliary, Main, Heavy, Superheavy); "sp" what it costs in system points. Armour has
// bonuses, weapons range and damage (or several "profiles", of which the first is shown). "effect" is the
// rules text (it can hold simple HTML), "description" the flavour. "licenceId" is the frame whose licence
// unlocks it and "licenceLevel" the rank needed (0: free, e.g. GMS); see docs/lancer-rules.md.
type Value = number | string
export type Bonus = {
  id: string
  // Not every bonus has one (superheavy_mounting); add_tags holds a list.
  val?: Value
  replace?: boolean
  overwrite?: boolean
  condition?: string
  detail?: string
  [key: string]: unknown
}
// What an item, core bonus, talent, frame or biomod needs before it can be used: a talent or licence rank, a core bonus, a commendation, or another item.
export type Requirement = { kind: 'talent' | 'licence'; id: string; rank: number } | { kind: 'core_bonus' | 'item' | 'commendation'; id: string }
export const REQUIREMENT_KINDS = ['talent', 'licence', 'core_bonus', 'commendation', 'item'] as const
export const requirementsOf = (data: unknown): Requirement[] => {
  const list = (data as { requires?: unknown } | null | undefined)?.requires
  return (Array.isArray(list) ? list : []).filter((entry): entry is Requirement =>
    !!entry && typeof entry === 'object' && (REQUIREMENT_KINDS as readonly string[]).includes(entry.kind) && typeof entry.id === 'string')
}
export type Item = {
  id: string
  name: string
  type: string
  mount: string
  sp: number
  licenceId: string
  licenceLevel: number
  description: string
  effect: string
  bonuses: Bonus[]
  range: { type: string; val: Value }[]
  damage: { type: string; val: Value }[]
  tags: { id: string; val?: Value }[]
  profiles?: Record<string, unknown>[]
  raw?: Record<string, unknown>
  sources?: string[]
  // Hidden from players' pickers and lists (an owner's choice). A pilot who has it keeps it, so lookups still find it.
  hidden?: boolean
}

// Pack data is plain JSON to the database; this picks out the fields the site shows.
export function toItem(id: string, data: unknown): Item {
  const item = (data ?? {}) as Record<string, unknown>
  const profile = (Array.isArray(item.profiles) ? item.profiles[0] : undefined) as Record<string, unknown> | undefined
  const list = <T>(value: unknown) => (Array.isArray(value) ? value : []) as T[]
  return {
    id,
    name: String(item.name ?? id),
    type: String(item.type ?? ''),
    mount: String(item.mount ?? ''),
    sp: Number(item.sp ?? 0) || 0,
    licenceId: String(item.license_id ?? ''),
    licenceLevel: Number(item.license_level ?? 0) || 0,
    description: String(item.description ?? ''),
    effect: String(item.effect ?? ''),
    bonuses: list<Item['bonuses'][number]>(item.bonuses).filter(bonus => bonus && typeof bonus === 'object' && typeof bonus.id === 'string' && bonus.id !== 'pilot_evasion'),
    range: list<Item['range'][number]>(item.range ?? profile?.range),
    damage: list<Item['damage'][number]>(item.damage ?? profile?.damage),
    tags: list<Item['tags'][number]>(item.tags),
    profiles: list<Record<string, unknown>>(item.profiles),
    raw: item,
    ...(item.hidden === true ? { hidden: true } : {}),
  }
}

// A weapon mod (lancer-data's mods.json) as an Item of type "Mod". Its allowed and restricted weapon types and sizes,
// and the range, damage and tags it adds to its weapon, stay in raw (src/equipment.ts reads them).
export const toMod = (id: string, data: unknown) => toItem(id, { ...(data as object), type: 'Mod' })

// Tag names by id (lancer-data's tags, e.g. "Limited {VAL}"), shared by every page. Loaded once.
export const tagNames = shallowRef(new Map<string, string>())
// Which pack each item came from (item id → pack name), for the "Source:" lines. Read once, like the catalogues.
export const packNames = shallowRef(new Map<string, string>())
export const sourceOf = (id: string) => packNames.value.get(id) ?? ''
export async function loadSources() {
  const { rows } = await cached('sources', () => fetchAll((from, to) => supabase.from('content_items').select('id, content_packs(name)').order('id').range(from, to)))
  packNames.value = new Map(rows.map(({ id, content_packs }) => [id, content_packs?.name ?? '']))
}
// Tags the data marks hidden: notes for the app (e.g. "Set Max Uses"), not something a player reads.
export const hiddenTags = shallowRef(new Set<string>())
// Tags an item card leaves out because the slot already says it.
export const cardHiddenTags = shallowRef(new Set<string>())
// The tags marked "Show on combat page".
export const combatTags = shallowRef<string[]>([])
// What each tag means (e.g. "This weapon or system can only be used {VAL} times..."), for the full-information dialog.
export const tagDescriptions = shallowRef(new Map<string, string>())
let tagsLoading: Promise<void> | undefined
// A new or updated pack changes the game content: the next page should read all of it again.
export const invalidateCatalogues = () => {
  clearCatalogues()
  tagsLoading = undefined
  actionsLoading = undefined
  rulesLoading = undefined
}
// Empty until loaded, and when the load fails (the catalogue notice says so).
export { baseActions }
// True once the load has settled (also when it failed), so a page can wait instead of flashing an empty list.
export const baseActionsLoaded = shallowRef(false)
let actionsLoading: Promise<void> | undefined
export function loadBaseActions() {
  actionsLoading ??= (async () => {
    try {
      const { rows, error } = await loadKind('actions')
      if (error) actionsLoading = undefined // not kept, so the next page tries again
      if (error || !rows) return
      const order = new Map(BASE_ACTIONS.map((a, i) => [a.id, i]))
      const at = (id: string) => order.get(id) ?? Infinity // the seed's order first, then the campaign's own
      // Every row hidden gives an empty list, not the seed.
      baseActions.value = rows.map(({ id, data }) => toBaseAction(id, data)).filter((a): a is BaseAction => !!a).sort((a, b) => (at(a.id) === at(b.id) ? 0 : at(a.id) < at(b.id) ? -1 : 1))
    } finally {
      baseActionsLoaded.value = true
    }
  })()
  return actionsLoading
}
// The combat rules (kind 'rules'). Empty until loaded, and when the load fails.
export const rulesLoaded = shallowRef(false)
let rulesLoading: Promise<void> | undefined
export function loadRules() {
  rulesLoading ??= (async () => {
    try {
      const { rows, error } = await loadKind('rules')
      if (error) rulesLoading = undefined // not kept, so the next page tries again
      if (error || !rows) return
      // Every row hidden gives no rules.
      ruleItems.value = rows.map(({ id, data }) => toRuleItem(id, data)).filter((r): r is NonNullable<typeof r> => !!r)
    } finally {
      rulesLoaded.value = true
    }
  })()
  return rulesLoading
}
// True once the tag names have loaded (also when it failed).
export const tagNamesLoaded = shallowRef(false)
export function loadTagNames() {
  tagsLoading ??= (async () => {
    try {
      const { rows: data, error } = await loadKind('tags')
      if (error) tagsLoading = undefined // not kept, so the next page tries again
      tagNames.value = new Map((data ?? []).map(({ id, data }) => [id, String((data as { name?: unknown } | null)?.name ?? id)]))
      tagDescriptions.value = new Map((data ?? []).map(({ id, data }) => [id, String((data as { description?: unknown } | null)?.description ?? '')]))
      combatTags.value = (data ?? []).filter(({ data }) => (data as { combat_page?: unknown } | null)?.combat_page === true).map(({ id }) => id)
      cardHiddenTags.value = new Set((data ?? []).filter(({ data }) => (data as { hideOnCard?: unknown } | null)?.hideOnCard === true).map(({ id }) => id))
      hiddenTags.value = new Set((data ?? []).filter(({ data }) => (data as { hidden?: unknown } | null)?.hidden === true).map(({ id }) => id))
    } finally {
      tagNamesLoaded.value = true
    }
  })()
  return tagsLoading
}
export type Bionic = {
  id: number
  name: string
  description: string | null
  slot: string
  // The manufacturer's id (HORUS, IPS-N...), or null for none.
  source: string | null
  // Rules text, simple HTML like an item's effect.
  effect: string
  // The price in manna.
  manna_cost: number
  mod_point_cost: number
  retired: boolean
  // The same fields every other kind has (migration 20261121140000_homebrew_rules.sql). "effect_bonuses" holds any bonus
  // ids, the personal stats included.
  effect_bonuses?: Bonus[]
  actions?: unknown[]
  integrated?: string[]
  special_equipment?: string[]
  replace_integrated?: boolean
  requires?: unknown
}
export type PilotStat = { id: string; name: string }
// The custom pilot stats. Also tells isPilotBonus which bonus ids are the pilot's.
export const loadPilotStats = () =>
  cached('pilot_stats', () => fetchAll((from, to) => supabase.from('pilot_stats').select('id, name').order('sort_order').order('id').range(from, to))).then((result) => {
    personalStatIds.value = new Set(result.rows.map((stat) => stat.id))
    return result
  })
// A talent: three ranks, each with a name and rules text (simple HTML). A core bonus: its manufacturer and
// rules text. Both from the imported LANCER packs.
export type TalentRank = { name: string; description: string; bonuses?: Bonus[]; integrated?: string[]; special_equipment?: string[]; exclusive?: boolean; [key: string]: unknown }
export type Talent = { id: string; name: string; terse: string; ranks: TalentRank[]; requires?: unknown; hidden?: boolean }
// integrated / special_equipment: items it builds in or unlocks. replace_integrated: its integrated weapons replace the frame's own.
export type CoreBonus = { id: string; name: string; source: string; effect: string; bonuses?: Bonus[]; integrated?: string[]; special_equipment?: string[]; replace_integrated?: boolean; hidden?: boolean; [key: string]: unknown }

// A pilot's loadout slots: one armour, two weapons, three gear unless an owner changed the numbers (rulesData.ts NUMBER_KEYS).
export const LOADOUT = [
  { type: 'Armor', label: 'pilot armour', get count() { return rule('loadout_armour') } },
  { type: 'Weapon', label: 'pilot weapon', get count() { return rule('loadout_weapons') } },
  { type: 'Gear', label: 'pilot gear', get count() { return rule('loadout_gear') } },
]
export type Slot = { type: string; label: string; index: number; id: string | null }

// The owned items that are equipped, in equipped order (a key that isn't owned is skipped).
export const equippedGear = (sheet: Pick<Sheet, 'owned_gear' | 'equipped_gear'>) =>
  (sheet.equipped_gear ?? []).flatMap(key => sheet.owned_gear?.find(owned => owned.key === key) ?? [])

// Sorts a loadout's ids (the equipped gear's ids) into its slots by item type, in the order they were added.
// Ids whose type isn't known (e.g. their pack was removed) are kept aside in "unknown", so saves keep them.
// More items of a type than it has slots only happens with sheets from before the slots: those are "overflow".
export function loadoutSlots(ids: string[], typeOf: (id: string) => string | undefined) {
  const byType = new Map<string, string[]>(LOADOUT.map((slot) => [slot.type, []]))
  const unknown: string[] = []
  for (const id of ids) {
    const list = byType.get(typeOf(id) ?? '')
    if (list) list.push(id)
    else unknown.push(id)
  }
  const slots: Slot[] = LOADOUT.flatMap(({ type, label, count }) =>
    Array.from({ length: count }, (_, index) => ({ type, label, index, id: byType.get(type)![index] ?? null })),
  )
  const overflow = LOADOUT.flatMap(({ type, count }) => byType.get(type)!.slice(count))
  return { slots, unknown, overflow }
}

// LANCER's mech skills (HASE). Fixed by the game, so they aren't a table.
export const MECH_SKILLS: PilotStat[] = [
  { id: 'hull', name: 'hull' },
  { id: 'agility', name: 'agility' },
  { id: 'systems', name: 'systems' },
  { id: 'engineering', name: 'engineering' },
]

// Symbols for the personal stats (by their pilot_stats ids) and HASE. A personal stat an owner adds later has none.
export const STAT_ICONS: Record<string, string> = {
  physicality: physicalityIcon, dexterity: dexterityIcon, perception: perceptionIcon, acuity: acuityIcon, tech_fluency: techFluencyIcon,
  hull: hullIcon, agility: agilityIcon, systems: systemsIcon, engineering: engineeringIcon,
}

// "Where these numbers come from" for a stat: "Base: 6" (unless a bonus sets it), then "Source: +2" or "Source: sets to 3"
// per bonus that counted.
function bonusLines(base: number, result: ReturnType<typeof resolveBonuses>) {
  return [
    ...(result.usesBase ? [`Base: ${base}`] : []),
    ...result.used.map(entry => `${entry.source}: ${entry.replace ? 'sets to ' : entry.value >= 0 ? '+' : ''}${entry.value}`),
  ]
}

// A sheet's stats, ready for StatRow, with bionic bonuses on the personal stats. Personal stats (house
// rule) start at 2 if never set; mech skills (HASE) start at 0, as in LANCER (docs/lancer-rules.md).
export function sheetStats(sheet: Sheet, pilotStats: PilotStat[], extraBonuses: NamedBonus[] = []) {
  const values = (key: 'pilot_stats' | 'mech_skills', stats: PilotStat[], start: number) =>
    stats.map((stat) => ({ id: stat.id, name: stat.name.toLowerCase(), icon: STAT_ICONS[stat.id], value: sheet[key]?.[stat.id] ?? start }))
  return {
    personal: values('pilot_stats', pilotStats, 2).map((stat) => {
      const entries = extraBonuses.filter(entry => entry.bonus.id === stat.id && permanentBonus(entry.bonus)).flatMap(entry => {
        const value = bonusValue(entry.bonus.val)
        return value === null ? [] : [{ source: entry.source, value, replace: entry.bonus.replace, overwrite: entry.bonus.overwrite }]
      })
      const result = resolveBonuses(stat.value, entries)
      const bonus = result.value - stat.value
      // Listed under the block only when something changes the stat.
      const conditional = extraBonuses.filter(entry => entry.bonus.id === stat.id && entry.bonus.condition).map(entry => uncountedLine(entry.source, entry.bonus))
      return { ...stat, bonus, contributors: [...(result.used.length ? bonusLines(stat.value, result) : []), ...conditional] }
    }),
    piloting: values('mech_skills', MECH_SKILLS, 0),
  }
}

// Only equipped slots count; an old overflowing loadout must not stack several suits of armour.
const equippedItems = (sheet: Sheet, gear: Item[]) => {
  const byId = new Map(gear.map(item => [item.id, item]))
  const layout = loadoutSlots(equippedGear(sheet).map(owned => owned.id), id => byId.get(id)?.type)
  return layout.slots.flatMap(slot => slot.id && byId.has(slot.id) ? [byId.get(slot.id)!] : [])
}

// Free talent ranks from installed biomods, taken core bonuses and equipped gear (slot-fitted, like pilotBonuses).
// Several sources for one talent add up. Never stored: total = bought + free.
export function talentRanks(sheet: Sheet, sources: { gear?: Item[]; coreBonuses?: CoreBonus[]; bionics?: Bionic[] }):
  { total: Record<string, number>; free: Record<string, { ranks: number; sources: string[] }> } {
  const free: Record<string, { ranks: number; sources: string[] }> = {}
  const add = (name: string, bonuses: Bonus[] | undefined) => {
    for (const bonus of bonuses ?? []) {
      const { id, talent, val, condition } = bonus
      if (id !== 'talent_rank' || typeof talent !== 'string' || condition || typeof val !== 'number' || !Number.isInteger(val) || val < 1) continue
      const entry = free[talent] ??= { ranks: 0, sources: [] }
      entry.ranks += val
      if (!entry.sources.includes(name)) entry.sources.push(name)
    }
  }
  for (const item of equippedItems(sheet, sources.gear ?? [])) add(item.name, item.bonuses)
  for (const core of sources.coreBonuses ?? []) if (sheet.core_bonuses?.includes(core.id)) add(core.name, core.bonuses)
  for (const bionic of sources.bionics ?? []) if (sheet.bionics?.includes(bionic.id)) add(bionic.name, bionic.effect_bonuses)
  const total: Record<string, number> = {}
  for (const [id, bought] of Object.entries(sheet.talents ?? {})) if (Number.isInteger(bought) && bought >= 0) total[id] = bought
  for (const [id, entry] of Object.entries(free)) total[id] = (total[id] ?? 0) + entry.ranks
  return { total, free }
}

// A ranked sheet is for reading only: never save it, or free ranks become bought ones and are charged.
const ranked = new WeakSet<Sheet>()
export function rankedSheet(sheet: Sheet, sources: Parameters<typeof talentRanks>[1]): Sheet {
  if (ranked.has(sheet)) return sheet
  const result = { ...sheet, talents: talentRanks(sheet, sources).total }
  ranked.add(result)
  return result
}

export function pilotBonuses(sheet: Sheet, gear: Item[], talents: Talent[] = [], coreBonuses: CoreBonus[] = [], bionics: Bionic[] = []): NamedBonus[] {
  sheet = rankedSheet(sheet, { gear, coreBonuses, bionics })
  const result = equippedItems(sheet, gear).flatMap(item => item.bonuses.map(bonus => ({ source: item.name, bonus })))
  for (const talent of talents) talent.ranks.slice(0, Math.min(rule('max_talent_rank'), Math.max(0, sheet.talents?.[talent.id] ?? 0))).forEach((rank, index) =>
    result.push(...(rank.bonuses ?? []).map(bonus => ({ source: `${talent.name} ${index + 1}`, bonus }))))
  for (const core of coreBonuses) if (sheet.core_bonuses?.includes(core.id)) result.push(...(core.bonuses ?? []).map(bonus => ({ source: core.name, bonus })))
  for (const bionic of bionics) if (sheet.bionics?.includes(bionic.id)) result.push(...(bionic.effect_bonuses ?? []).map(bonus => ({ source: bionic.name, bonus })))
  return result
}

export function pilotVitals(sheet: Sheet, gear: Item[], talents: Talent[] = [], coreBonuses: CoreBonus[] = [], bionics: Bionic[] = []) {
  const byId = new Map(gear.map(item => [item.id, item]))
  const layout = loadoutSlots(equippedGear(sheet).map(owned => owned.id), id => byId.get(id)?.type)
  const bonuses = pilotBonuses(sheet, gear, talents, coreBonuses, bionics)
  const stats = [
    { id: 'pilot_hp', name: 'HP', value: 6, icon: hpIcon },
    { id: 'pilot_armor', name: 'Armour', value: 0, icon: armourIcon },
    { id: 'pilot_speed', name: 'Speed', value: 4, icon: speedIcon },
    { id: 'pilot_edef', name: 'E-defence', value: 10, icon: eDefIcon },
  ]
  return stats.map(stat => {
    const matching = bonuses.filter(entry => entry.bonus.id === stat.id && permanentBonus(entry.bonus)).flatMap(({ bonus, source }) => {
      const value = bonusValue(bonus.val, { ll: Object.values(sheet.licences ?? {}).reduce((sum, rank) => sum + rank, 0) })
      return value === null ? [] : [{ source, value, replace: bonus.replace, overwrite: bonus.overwrite }]
    })
    const result = resolveBonuses(stat.value, matching)
    const conditional = bonuses.filter(entry => entry.bonus.id === stat.id && entry.bonus.condition).map(entry => uncountedLine(entry.source, entry.bonus))
    return { ...stat, value: layout.unknown.length ? null : Math.max(0, result.value), contributors: layout.unknown.length ? [] : [...bonusLines(stat.value, result), ...conditional] }
  })
}

// A biomod's counted personal-stat effects, for its facts and stat tiles.
export const bionicStats = (b: Bionic) => (b.effect_bonuses ?? []).flatMap((bonus) => {
  const value = bonusValue(bonus.val)
  return personalStatIds.value.has(bonus.id) && permanentBonus(bonus) && value !== null ? [{ id: bonus.id, value }] : []
})

// Bionics as LoadoutBox items: the slot, bonuses and manna price as the subtitle (and the bonuses as stats with symbols, for
// the cards), the mod-point cost as the cost, the price for the picker's affordability check.
export const bionicItems = (catalogue: Bionic[]) =>
  catalogue.map((b) => ({
    id: b.id,
    name: b.name,
    // The picker's facts line, before the mod points and price: maker, slot, then each bonus.
    facts: [b.source ?? '', b.slot, ...bionicStats(b).map((stat) => `${stat.value > 0 ? '+' : ''}${stat.value} ${stat.id.replace('_', '-')}`)].filter(Boolean),
    source: b.source ?? '',
    slot: b.slot,
    effect: b.effect,
    price: b.manna_cost,
    stats: bionicStats(b).map((stat) => ({ label: stat.id.replace('_', '-'), value: `${stat.value > 0 ? '+' : ''}${stat.value}`, icon: STAT_ICONS[stat.id] })),
    description: b.description,
    cost: b.mod_point_cost,
    retired: b.retired,
  }))

// A talent and a core bonus from their pack data (also the content editor's preview).
export function toTalent(id: string, data: unknown): Talent {
  const talent = (data ?? {}) as { name?: string; terse?: string; ranks?: TalentRank[] }
  const ranks = (talent.ranks ?? []).map((rank) => ({ ...rank, name: String(rank.name ?? ''), description: flatDamageText(String(rank.description ?? '')), bonuses: Array.isArray(rank.bonuses) ? rank.bonuses : [] }))
  return { id, name: String(talent.name ?? id), terse: String(talent.terse ?? ''), ranks, requires: (talent as { requires?: unknown }).requires, ...((talent as { hidden?: unknown }).hidden === true ? { hidden: true } : {}) }
}
export function toCoreBonus(id: string, data: unknown): CoreBonus {
  const bonus = (data ?? {}) as { name?: string; source?: string; effect?: string; bonuses?: Bonus[] }
  return { ...((data ?? {}) as object), id, name: String(bonus.name ?? id), source: String(bonus.source ?? ''), effect: flatDamageText(String(bonus.effect ?? '')), bonuses: Array.isArray(bonus.bonuses) ? bonus.bonuses : [], ...((bonus as { hidden?: unknown }).hidden === true ? { hidden: true } : {}) }
}

export function useGameData() {
  const gear = shallowRef<Item[]>([])
  const bionics = shallowRef<Bionic[]>([])
  // Each biomod's price in manna, by id (what mannaSpent() reads).
  const bionicPrices = computed(() => new Map(bionics.value.map((bionic) => [bionic.id, bionic.manna_cost])))
  const pilotStats = shallowRef<PilotStat[]>([])
  const talents = shallowRef<Talent[]>([])
  const coreBonuses = shallowRef<CoreBonus[]>([])

  async function load() {
    loadTagNames()
    loadBaseActions()
    loadSources()
    loadRules()
    loadDefinitions()
    const [gearRows, talentRows, coreRows, bionicRows, statRows] = await Promise.all([
      loadKind('pilot_gear'),
      loadKind('talents'),
      loadKind('core_bonuses'),
      cached('bionics', () => fetchAll((from, to) => supabase.from('bionics').select('*').order('name').order('id').range(from, to))),
      loadPilotStats(),
    ])
    gear.value = gearRows.rows
      .map(({ id, data }) => toItem(id, data))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    // The table only holds a list here (a check on the column).
    bionics.value = bionicRows.rows.map((row) => ({ ...row, effect_bonuses: row.effect_bonuses as Bonus[], actions: row.actions as unknown[] }))
    pilotStats.value = statRows.rows
    talents.value = talentRows.rows.map(({ id, data }) => toTalent(id, data)).sort((a, b) => a.name.localeCompare(b.name))
    talentNames.value = new Map(talents.value.map(talent => [talent.id, talent.name]))
    coreBonuses.value = coreRows.rows
      .map(({ id, data }) => toCoreBonus(id, data))
      .sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
  }

  load()
  watch(reloads, load)

  return { gear, bionics, bionicPrices, pilotStats, talents, coreBonuses }
}
