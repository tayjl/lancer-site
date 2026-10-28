import { shallowRef } from 'vue'
import armourIcon from './assets/icons/armour.svg'
import evasionIcon from './assets/icons/evasion.svg'
import heatIcon from './assets/icons/heat.svg'
import hpIcon from './assets/icons/hp.svg'
import stressIcon from './assets/icons/reactor.svg'
import repairIcon from './assets/icons/repair.svg'
import structureIcon from './assets/icons/structure.svg'
import systemPointIcon from './assets/icons/system_point.svg'
import { supabase } from './lib/supabaseClient'
import type { Sheet } from './myPilot'

// The catalogues the pilot sheet picks from: pilot gear (from the imported LANCER packs), the site's own
// bionics, and the custom pilot stats. Characters only store ids; names and details come from here.

export type GearItem = { id: string; name: string; type: string; description: string }
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

// LANCER's mech skills (HASE). Fixed by the game, so they aren't a table.
export const MECH_SKILLS: PilotStat[] = [
  { id: 'hull', name: 'hull' },
  { id: 'agility', name: 'agility' },
  { id: 'systems', name: 'systems' },
  { id: 'engineering', name: 'engineering' },
]

// A mech's stats, in COMP/CON's order, with LANCER's symbols (src/assets/icons: COMP/CON's, plus Material
// Design's heart and shield, as COMP/CON uses for hp and armour). They come from the frame and the pilot's
// choices, so they're worked out, never stored.
// shortcut: every value is null ("-") until frames are imported; then calculate them from the frame and HASE.
const MECH_STATS = [
  ['structure', 'structure', structureIcon],
  ['stress', 'stress', stressIcon],
  ['hp', 'hp', hpIcon],
  ['heat', 'heat cap', heatIcon],
  ['armour', 'armour', armourIcon],
  ['evasion', 'evasion', evasionIcon],
  ['repair', 'repair cap', repairIcon],
  ['system_points', 'system points', systemPointIcon],
] as const

export const mechStats = () => MECH_STATS.map(([id, name, icon]) => ({ id, name, icon, value: null }))

// A sheet's stats, ready for StatRow: every stat (1 if it was never set), with bionic bonuses on the
// personal stats. Used by your own sheet and by the GM review.
export function sheetStats(sheet: Sheet, pilotStats: PilotStat[], catalogue: Bionic[]) {
  const installed = catalogue.filter((b) => sheet.bionics?.includes(b.id)).flatMap((b) => b.bonuses)
  const bonusFor = (statId: string) => installed.reduce((sum, bonus) => sum + (bonus.stat_id === statId ? bonus.amount : 0), 0)
  const values = (key: 'pilot_stats' | 'mech_skills', stats: PilotStat[]) =>
    stats.map((stat) => ({ id: stat.id, name: stat.name.toLowerCase(), value: sheet[key]?.[stat.id] ?? 1 }))
  return {
    personal: values('pilot_stats', pilotStats).map((stat) => ({ ...stat, bonus: bonusFor(stat.id) })),
    piloting: values('mech_skills', MECH_SKILLS),
  }
}

// Bionics as LoadoutBox items: the bonuses and manna cost as the subtitle, the mod-point cost as the cost.
export const bionicItems = (catalogue: Bionic[]) =>
  catalogue.map((b) => ({
    id: b.id,
    name: b.name,
    type: [...b.bonuses.map((bonus) => `+${bonus.amount} ${bonus.stat_id.replace('_', '-')}`), `${b.manna_cost} manna`].join(', '),
    description: b.description,
    cost: b.mod_point_cost,
    retired: b.retired,
  }))

export function useGameData() {
  const gear = shallowRef<GearItem[]>([])
  const bionics = shallowRef<Bionic[]>([])
  const pilotStats = shallowRef<PilotStat[]>([])

  async function load() {
    const [gearRows, bionicRows, statRows] = await Promise.all([
      supabase.from('content_items').select('id, data').eq('kind', 'pilot_gear'),
      supabase.from('bionics').select('*, bonuses:bionic_bonuses(stat_id, amount)').order('name'),
      supabase.from('pilot_stats').select('id, name').order('sort_order'),
    ])
    // Pack data is plain JSON to the database; pick out the fields the sheet shows.
    gear.value = (gearRows.data ?? [])
      .map(({ id, data }) => {
        const item = (data ?? {}) as Record<string, unknown>
        return { id, name: String(item.name ?? id), type: String(item.type ?? 'Gear'), description: String(item.description ?? '') }
      })
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    bionics.value = bionicRows.data ?? []
    pilotStats.value = statRows.data ?? []
  }

  load()

  return { gear, bionics, pilotStats }
}
