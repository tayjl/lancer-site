import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { combatLoadout, frameGroups, gearGroups, weaponGroups, type LoadoutRow } from './combatLoadout'
import { actionKey, stepActions, type KitAction } from './combatEntries'
import { toItem, type Bionic, type Item } from './gameData'
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
  it('lists a biomod action in its own block', () => {
    const eye = { id: 1, name: 'Eye', effect: '', actions: [{ name: 'Flash', activation: 'Quick', detail: 'Blind a target.' }] } as unknown as Bionic
    const { rows } = combatLoadout({}, { bionics: [1] }, { ...catalogue, bionics: [eye] }, tagNames)
    expect(rows).toEqual([expect.objectContaining({ block: 'biomods', kind: 'biomod', label: 'Biomod', name: 'Flash', activation: 'Quick', html: 'Blind a target.' })])
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

describe('weaponGroups', () => {
  const builtIn = [...weapons.keys()].find(id => id !== 'mw_assault_rifle' && id !== 'mw_missile_rack' && weapons.get(id)!.mount)!
  const frame: Frame = { ...everest, mounts: ['Main', 'Flex', 'Heavy', 'Main'], integrated: [builtIn] }
  const mounts = [['mw_assault_rifle'], ['mw_missile_rack', 'mw_missile_rack'], ['mw_assault_rifle'], []]
  const rows = () => combatLoadout({ frame: frame.id, mounts }, {}, { ...catalogue, frames: [frame] }, tagNames).rows

  it('groups by mount in order, skips empty mounts and puts integrated last', () => {
    const groups = weaponGroups(rows(), frame)
    expect(groups.map(g => [g.title, g.sub, g.rows.length])).toEqual([['Mount 1', 'Main', 1], ['Mount 2', 'Flex', 2], ['Mount 3', 'Heavy', 1], ['Integrated', undefined, 1]])
  })
  it('ignores rows that are not weapons and keeps a weapon mod', () => {
    const all = rows()
    all.find(row => row.mount?.index === 0)!.mods.push({ name: 'Mod', html: '', tags: [], item: all[0].item! })
    const groups = weaponGroups(all, frame)
    expect(groups.flatMap(g => g.rows).every(row => row.block === 'weapons')).toBe(true)
    expect(groups[0].rows[0].mods).toHaveLength(1)
  })
  it('returns nothing without a frame', () => {
    expect(weaponGroups(rows(), null)).toEqual([])
  })
})

describe('gear', () => {
  const gearItem = (id: string, type: string): Item => ({ ...[...weapons.values()][0], id, name: id, type, mount: '', tags: [{ id: 'tg_loading' }], damage: [], range: [] })
  const row = (name: string, slot?: LoadoutRow['slot'], block: LoadoutRow['block'] = 'gear'): LoadoutRow => ({ block, name, slot, stats: [], tags: [], html: '', rules: [], mods: [] })

  it('gives gear rows their slot and keeps their tags out of the tag list', () => {
    const gear = [gearItem('a', 'Armor'), gearItem('w', 'Weapon')]
    const sheet = { owned_gear: [{ key: 'k1', id: 'a' }, { key: 'k2', id: 'w' }], equipped_gear: ['k1', 'k2'] } as never
    const { rows, tagIds, gearTagIds } = combatLoadout({}, sheet, { ...catalogue, gear }, tagNames)
    expect(rows.map(r => [r.block, r.slot])).toEqual([['gear', 'Armor'], ['gear', 'Weapon']])
    expect(tagIds.size).toBe(0)
    expect([...gearTagIds]).toEqual(['tg_loading'])
  })
  it('groups gear by slot in order and leaves empty groups out', () => {
    const rows = [row('g1', 'Gear'), row('a1', 'Armor'), row('w1', 'Weapon'), row('g2', 'Gear')]
    expect(gearGroups(rows).map(g => [g.title, g.rows.map(r => r.name)])).toEqual([['Armour', ['a1']], ['Weapons', ['w1']], ['Gear', ['g1', 'g2']]])
    expect(gearGroups([row('g1', 'Gear')]).map(g => g.title)).toEqual(['Gear'])
    expect(gearGroups([])).toEqual([])
  })
  it('puts an unknown slot in Other and ignores non-gear rows', () => {
    const rows = [row('x', 'Odd' as never), row('y'), row('mech', undefined, 'systems'), row('a1', 'Armor')]
    expect(gearGroups(rows).map(g => [g.title, g.rows.map(r => r.name)])).toEqual([['Armour', ['a1']], ['Other', ['x', 'y']]])
  })
})

describe('chosen damage type', () => {
  const variable: Item = { ...weapons.get('mw_assault_rifle')!, id: 'mw_variable_test', damage: [{ type: 'Variable', val: 2 }] }
  const withVariable = { ...catalogue, weapons: new Map([...weapons, [variable.id, variable]]) }
  const mounts = everest.mounts.map(mount => (mount === 'Main' ? [variable.id] : []))
  const damageOf = (weapon_options?: Record<string, { damageType: string }>) => {
    const row = combatLoadout({ frame: everest.id, mounts, weapon_options }, {}, withVariable, tagNames).rows.find(r => r.item?.id === variable.id)!
    return row.item!.damage.map(d => d.type)
  }
  const key = `${mounts.findIndex(m => m.length)}:0`

  it('shows the chosen type on a Variable mech weapon', () => {
    expect(damageOf({ [key]: { damageType: 'Energy' } })).toEqual(['Energy'])
  })
  it('still says Variable when no type is chosen', () => {
    expect(damageOf()).toEqual(['Variable'])
  })
  it('shows the chosen type on a gear weapon', () => {
    const gear: Item = { ...variable, id: 'gear_variable_test', type: 'Weapon', mount: '' }
    const sheet = (damageType?: string) => ({ owned_gear: [{ key: 'k', id: gear.id, damageType }], equipped_gear: ['k'] }) as never
    const typesFor = (damageType?: string) => combatLoadout({}, sheet(damageType), { ...catalogue, gear: [gear] }, tagNames).rows[0].item!.damage.map(d => d.type)
    expect(typesFor('Explosive')).toEqual(['Explosive'])
    expect(typesFor()).toEqual(['Variable'])
  })
})

describe('free talent ranks', () => {
  it("shows Hunter II's thrown range from a free rank", () => {
    const blade: Item = { ...weapons.get('mw_assault_rifle')!, id: 'blade', name: 'Blade', type: 'Melee', mount: 'Auxiliary', range: [{ type: 'Threat', val: 1 }] }
    const arm = { id: 1, name: 'Arm', effect: '', effect_bonuses: [{ id: 'talent_rank', talent: 't_hunter', val: 2 }] } as unknown as Bionic
    const mounts = everest.mounts.map(mount => (mount === 'Flex' ? ['blade'] : []))
    const cat = { ...catalogue, weapons: new Map([['blade', blade]]), integrated: new Map([['blade', blade]]), bionics: [arm] }
    const thrown = (sheet: object) => combatLoadout({ frame: everest.id, mounts }, sheet, cat, tagNames).rows.find(row => row.name === 'Blade')?.stats.find(stat => stat.label === 'thrown')?.value
    expect(thrown({ bionics: [1] })).toBe('5')
    expect(thrown({})).toBeUndefined()
  })
})
