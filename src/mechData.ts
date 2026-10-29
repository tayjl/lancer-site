import { shallowRef } from 'vue'
import armourIcon from './assets/icons/armour.svg'
import evasionIcon from './assets/icons/evasion.svg'
import heatIcon from './assets/icons/heat.svg'
import hpIcon from './assets/icons/hp.svg'
import stressIcon from './assets/icons/reactor.svg'
import repairIcon from './assets/icons/repair.svg'
import structureIcon from './assets/icons/structure.svg'
import systemPointIcon from './assets/icons/system_point.svg'
import { loadTagNames, toItem, type Item } from './gameData'
import { supabase } from './lib/supabaseClient'

// The mech page's catalogues (frames, mech weapons, systems, from the imported LANCER packs) and its rules:
// which weapons fit which mount, and the mech's stats. Mechs only store ids; everything else comes from here.

// A frame as lancer-data has it, cut down: its mounts (e.g. Flex, Main, Heavy), its base stats, the licence
// rank it needs in its own licence (2; 0 for GMS frames) and the weapons and systems built into it.
export type Frame = {
  id: string
  name: string
  source: string
  licenceLevel: number
  integrated: string[]
  mechtype: string[]
  mounts: string[]
  stats: Record<string, number>
  description: string
}

// Which weapon sizes each place on a mount takes. Most mounts hold one weapon; Flex, Main/Aux and Aux/Aux hold two.
const MOUNT_SLOTS: Record<string, string[][]> = {
  Main: [['Main', 'Auxiliary']],
  // A Superheavy weapon also needs a second, empty mount: see bracingMount() in src/rules.ts.
  Heavy: [['Superheavy', 'Heavy', 'Main', 'Auxiliary']],
  Flex: [['Main', 'Auxiliary'], ['Auxiliary']],
  'Main/Aux': [['Main', 'Auxiliary'], ['Auxiliary']],
  'Aux/Aux': [['Auxiliary'], ['Auxiliary']],
}

// How many weapons a mount holds.
export const mountSize = (mount: string) => MOUNT_SLOTS[mount]?.length ?? 1

// The weapon sizes place "index" on a mount takes, given the sizes already on it (null where empty).
// A Flex mount holds one Main weapon or two Auxiliary ones, so a Main weapon closes its second place.
export function allowedSizes(mount: string, index: number, sizesOnMount: (string | null)[]) {
  const allowed = MOUNT_SLOTS[mount]?.[index] ?? []
  if (mount !== 'Flex') return allowed
  if (index === 0) return sizesOnMount[1] ? ['Auxiliary'] : allowed
  return sizesOnMount[0] === 'Main' ? [] : allowed
}

// LANCER's mech stats, in COMP/CON's order, with their symbols (src/assets/icons: COMP/CON's, plus Material
// Design's heart and shield, as COMP/CON uses for hp and armour). Worked out from the frame and the pilot's
// HASE (unset skills count as 0, like the pilot sheet), never stored. No grit (homebrew rule).
// shortcut: talents, core bonuses and system bonuses aren't counted yet; add them once those are on the sheet.
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

export function mechStats(frame: Frame | null, skills: Record<string, number> | undefined) {
  const skill = (id: string) => skills?.[id] ?? 0
  const s = frame?.stats ?? {}
  const values: Record<string, number> = {
    structure: s.structure,
    stress: s.stress,
    hp: s.hp + 2 * skill('hull'),
    heat: s.heatcap + skill('engineering'),
    armour: s.armor,
    evasion: s.evasion + skill('agility'),
    repair: s.repcap + Math.floor(skill('hull') / 2),
    system_points: s.sp + Math.floor(skill('systems') / 2),
  }
  return MECH_STATS.map(([id, name, icon]) => ({ id, name, icon, value: frame ? values[id] : null }))
}

// Every "integrated" list inside a frame (core systems and traits): weapons and systems built into it.
function integratedIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(integratedIds)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, inner]) =>
    key === 'integrated' && Array.isArray(inner) ? inner.map(String) : integratedIds(inner),
  )
}

export function useMechData() {
  const frames = shallowRef<Frame[]>([])
  const weapons = shallowRef<Item[]>([])
  const systems = shallowRef<Item[]>([])
  // Weapons and systems built into frames, by id: shown on the mech, never picked.
  const integrated = shallowRef(new Map<string, Item>())

  async function load() {
    loadTagNames()
    const { data } = await supabase.from('content_items').select('id, kind, data').in('kind', ['frames', 'weapons', 'systems'])
    const rows = data ?? []
    const frameRows = rows.filter((row) => row.kind === 'frames')
    // Built-in and talent-only items can't be picked: they come with a frame or a talent.
    const builtIn = new Set(frameRows.flatMap((row) => integratedIds(row.data)))
    const pickable = (kind: string) =>
      rows
        .filter((row) => row.kind === kind && !builtIn.has(row.id) && !(row.data as { talent_item?: boolean } | null)?.talent_item)
        .map((row) => toItem(row.id, row.data))

    integrated.value = new Map(
      rows.filter((row) => row.kind !== 'frames' && builtIn.has(row.id)).map((row) => [row.id, toItem(row.id, row.data)]),
    )
    frames.value = frameRows
      .map(({ id, data }) => {
        const frame = (data ?? {}) as Record<string, unknown>
        return {
          id,
          name: String(frame.name ?? id),
          source: String(frame.source ?? ''),
          licenceLevel: Number(frame.license_level ?? 0) || 0,
          integrated: integratedIds(frame),
          mechtype: Array.isArray(frame.mechtype) ? frame.mechtype.map(String) : [],
          mounts: Array.isArray(frame.mounts) ? frame.mounts.map(String) : [],
          stats: (frame.stats ?? {}) as Record<string, number>,
          description: String(frame.description ?? ''),
        }
      })
      .sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
    weapons.value = pickable('weapons').sort((a, b) => a.name.localeCompare(b.name))
    systems.value = pickable('systems').sort((a, b) => a.name.localeCompare(b.name))
  }

  load()

  return { frames, weapons, systems, integrated }
}
