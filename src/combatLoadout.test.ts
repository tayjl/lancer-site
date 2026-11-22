import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { combatLoadout, frameGroups } from './combatLoadout'
import { actionKey, stepActions, type KitAction } from './combatEntries'
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

  // The same rule as CombatView's kitActions: a row with a known activation is a kit action.
  const frameWith = (core: Record<string, unknown>, actions: unknown[] = []): Frame => ({ ...everest, id: 'mf_test', raw: { ...everestData, traits: [{ name: 'Trait X', description: 'Does X.' }], core_system: { name: 'Big Gun', passive_name: 'Passive', passive_effect: 'Always on.', active_name: 'Big Gun', active_effect: 'Fires.', active_actions: actions, ...core } } })
  const run = (frame: Frame) => combatLoadout({ frame: frame.id }, {}, { ...catalogue, frames: [frame] }, tagNames)
  const kit = (rows: ReturnType<typeof run>['rows']): KitAction[] =>
    rows.filter(row => row.activation).map(row => ({ label: row.label, name: row.name, activation: row.activation, text: row.html, block: row.block, key: actionKey(row.activation), gist: undefined }))
  const power = (rows: ReturnType<typeof run>['rows']) => rows.find(row => row.kind === 'core-power')!

  it('keeps a core power activation set on the core system', () => {
    const { rows } = run(frameWith({ activation: 'Protocol' }))
    expect(power(rows).activation).toBe('Protocol')
    const protocols = stepActions('Protocol', kit(rows)).find(g => g.title === 'Protocols')!
    expect(protocols.entries.map(e => e.name)).toEqual(['Big Gun'])
  })
  it('puts a Quick core power under 2 quick Your kit', () => {
    const { rows } = run(frameWith({ activation: 'Quick' }))
    const yours = stepActions('2 quick', kit(rows)).find(g => g.title === 'Your kit')!
    expect(yours.entries.map(e => e.name)).toEqual(['Big Gun'])
  })
  it("prefers the action twin's own activation", () => {
    const { rows } = run(frameWith({ activation: 'Protocol' }, [{ name: 'Big Gun', activation: 'Full', detail: 'Twin text.' }]))
    expect(power(rows).activation).toBe('Full')
  })
  it('ignores an activation word it does not know, or none', () => {
    expect(power(run(frameWith({ activation: 'Active' })).rows).activation).toBeUndefined()
    expect(power(run(frameWith({ activation: '' })).rows).activation).toBeUndefined()
    expect(power(run(frameWith({})).rows).activation).toBeUndefined()
  })
  it('tags each frame row with its kind', () => {
    const { rows } = run(frameWith({ activation: 'Protocol' }))
    const kinds = rows.filter(row => row.block === 'frame').map(row => row.kind)
    expect(kinds).toEqual(expect.arrayContaining(['trait', 'core', 'core-power']))
    expect(rows.find(row => row.name === 'Trait X')?.kind).toBe('trait')
  })
})

describe('frameGroups', () => {
  it('orders groups, leaves empty ones out and keeps activations', () => {
    const rows = [{ kind: 'frame', name: 'Overcharge Heat' }, { kind: 'core-power', name: 'Siege', activation: 'Protocol' }, { kind: 'trait', name: 'A' }, { kind: 'trait', name: 'B' }]
    const groups = frameGroups(rows)
    expect(groups.map(group => group.title)).toEqual(['Traits', 'Core power', 'Overcharge'])
    expect(groups[1].rows[0].activation).toBe('Protocol')
    expect(groups[0].rows.map(row => row.name)).toEqual(['A', 'B'])
  })
})
