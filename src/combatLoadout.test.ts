import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { combatLoadout } from './combatLoadout'
import { toItem, type Item } from './gameData'
import type { EffectCatalogue, Frame } from './mechData'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const items = (kind: string) => new Map<string, Item>(coreContent.items.filter(item => item.kind === kind).map(item => [item.id, toItem(item.id, item.data)]))
const everestData = coreContent.items.find(item => item.id === 'mf_standard_pattern_i_everest')!.data as Record<string, unknown>
const everest: Frame = { id: 'mf_standard_pattern_i_everest', name: String(everestData.name), source: String(everestData.source), licenceLevel: 0, integrated: [], mechtype: [], mounts: everestData.mounts as string[], stats: everestData.stats as Record<string, number>, description: '', raw: everestData }
const weapons = items('weapons')
const catalogue: EffectCatalogue = { frames: [everest], weapons, systems: items('systems'), integrated: new Map(weapons), mods: new Map() }
const tagNames = new Map([['tg_reliable', 'Reliable {VAL}'], ['tg_loading', 'Loading']])

describe('combat loadout', () => {
  it('lists the weapons a mech carries and the sizes and tags to explain', () => {
    const mounts = everest.mounts.map(mount => (mount === 'Flex' ? ['mw_missile_rack'] : mount === 'Main' ? ['mw_assault_rifle'] : []))
    const { rows, sizes, tagIds, structureRepairs } = combatLoadout({ frame: everest.id, mounts }, {}, catalogue, tagNames)
    expect(rows.filter(row => row.block === 'weapons').map(row => row.label)).toEqual(expect.arrayContaining(['Main Rifle', 'Auxiliary Launcher']))
    expect(rows.filter(row => row.block === 'weapons').every(row => row.item?.name === row.name)).toBe(true)
    expect([...sizes].sort()).toEqual(['Auxiliary', 'Main'])
    expect(tagIds.has('tg_reliable') && tagIds.has('tg_loading')).toBe(true)
    expect(structureRepairs).toBe(1)
  })
  it('has no weapons without a frame', () => {
    const loadout = combatLoadout({}, {}, catalogue, tagNames)
    expect(loadout.frame).toBeNull()
    expect(loadout.rows.filter(row => row.block === 'weapons')).toEqual([])
  })
})
