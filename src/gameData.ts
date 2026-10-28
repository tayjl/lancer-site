import { shallowRef } from 'vue'
import { supabase } from './lib/supabaseClient'

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
