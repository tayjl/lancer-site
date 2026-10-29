import { shallowRef } from 'vue'
import { supabase } from './lib/supabaseClient'
import type { Sheet } from './myPilot'

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
  bonuses: { id: string; val: Value; replace?: boolean }[]
  range: { type: string; val: Value }[]
  damage: { type: string; val: Value }[]
  tags: { id: string; val?: Value }[]
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
    bonuses: list<Item['bonuses'][number]>(item.bonuses),
    range: list<Item['range'][number]>(item.range ?? profile?.range),
    damage: list<Item['damage'][number]>(item.damage ?? profile?.damage),
    tags: list<Item['tags'][number]>(item.tags),
  }
}

// Tag names by id (lancer-data's tags, e.g. "Limited {VAL}"), shared by every page. Loaded once.
export const tagNames = shallowRef(new Map<string, string>())
let tagsLoading: Promise<void> | undefined
export function loadTagNames() {
  tagsLoading ??= (async () => {
    const { data } = await supabase.from('content_items').select('id, data').eq('kind', 'tags')
    tagNames.value = new Map((data ?? []).map(({ id, data }) => [id, String((data as { name?: unknown } | null)?.name ?? id)]))
  })()
  return tagsLoading
}
export type Bionic = {
  id: number
  name: string
  description: string | null
  manna_cost: number
  mod_point_cost: number
  retired: boolean
  bonuses: { stat_id: string; amount: number }[]
}
export type PilotStat = { id: string; name: string }
// A talent: three ranks, each with a name and rules text (simple HTML). A core bonus: its manufacturer and
// rules text. Both from the imported LANCER packs.
export type Talent = { id: string; name: string; terse: string; ranks: { name: string; description: string }[] }
export type CoreBonus = { id: string; name: string; source: string; effect: string }

// A pilot's loadout slots: one armour, two weapons, three gear.
const LOADOUT = [
  { type: 'Armor', label: 'pilot armour', count: 1 },
  { type: 'Weapon', label: 'pilot weapon', count: 2 },
  { type: 'Gear', label: 'pilot gear', count: 3 },
] as const
export type Slot = { type: string; label: string; index: number; id: string | null }

// Sorts a loadout's ids (sheet.pilot_gear) into its slots by item type, in the order they were added.
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

// A sheet's stats, ready for StatRow, with bionic bonuses on the personal stats. Personal stats (house
// rule) start at 1 if never set; mech skills (HASE) start at 0, as in LANCER (docs/lancer-rules.md).
export function sheetStats(sheet: Sheet, pilotStats: PilotStat[], catalogue: Bionic[]) {
  const installed = catalogue.filter((b) => sheet.bionics?.includes(b.id)).flatMap((b) => b.bonuses)
  const bonusFor = (statId: string) => installed.reduce((sum, bonus) => sum + (bonus.stat_id === statId ? bonus.amount : 0), 0)
  const values = (key: 'pilot_stats' | 'mech_skills', stats: PilotStat[], start: number) =>
    stats.map((stat) => ({ id: stat.id, name: stat.name.toLowerCase(), value: sheet[key]?.[stat.id] ?? start }))
  return {
    personal: values('pilot_stats', pilotStats, 1).map((stat) => ({ ...stat, bonus: bonusFor(stat.id) })),
    piloting: values('mech_skills', MECH_SKILLS, 0),
  }
}

// Bionics as LoadoutBox items: the bonuses and manna price as the subtitle, the mod-point cost as the cost.
// Every biomod costs the same (homebrew; PRICES in src/rules.ts), so the bionics table's own manna_cost is unused.
export const bionicItems = (catalogue: Bionic[], price: number) =>
  catalogue.map((b) => ({
    id: b.id,
    name: b.name,
    type: [...b.bonuses.map((bonus) => `+${bonus.amount} ${bonus.stat_id.replace('_', '-')}`), `${price} manna`].join(', '),
    description: b.description,
    cost: b.mod_point_cost,
    retired: b.retired,
  }))

export function useGameData() {
  const gear = shallowRef<Item[]>([])
  const bionics = shallowRef<Bionic[]>([])
  const pilotStats = shallowRef<PilotStat[]>([])
  const talents = shallowRef<Talent[]>([])
  const coreBonuses = shallowRef<CoreBonus[]>([])

  async function load() {
    loadTagNames()
    const [contentRows, bionicRows, statRows] = await Promise.all([
      supabase.from('content_items').select('id, kind, data').in('kind', ['pilot_gear', 'talents', 'core_bonuses']),
      supabase.from('bionics').select('*, bonuses:bionic_bonuses(stat_id, amount)').order('name'),
      supabase.from('pilot_stats').select('id, name').order('sort_order'),
    ])
    const rows = contentRows.data ?? []
    const of = (kind: string) => rows.filter((row) => row.kind === kind)
    gear.value = of('pilot_gear')
      .map(({ id, data }) => toItem(id, data))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    bionics.value = bionicRows.data ?? []
    pilotStats.value = statRows.data ?? []
    talents.value = of('talents')
      .map(({ id, data }) => {
        const talent = (data ?? {}) as { name?: string; terse?: string; ranks?: { name?: string; description?: string }[] }
        const ranks = (talent.ranks ?? []).map((rank) => ({ name: String(rank.name ?? ''), description: String(rank.description ?? '') }))
        return { id, name: String(talent.name ?? id), terse: String(talent.terse ?? ''), ranks }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    coreBonuses.value = of('core_bonuses')
      .map(({ id, data }) => {
        const bonus = (data ?? {}) as { name?: string; source?: string; effect?: string }
        return { id, name: String(bonus.name ?? id), source: String(bonus.source ?? ''), effect: String(bonus.effect ?? '') }
      })
      .sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
  }

  load()

  return { gear, bionics, pilotStats, talents, coreBonuses }
}
