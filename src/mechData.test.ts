import { describe, expect, it, vi } from 'vitest'
import { allowedSizes, mechEffects, mechStats, mountSize, type EffectCatalogue, type Frame, type StatModifier } from './mechData'
import { toItem } from './gameData'
import type { Sheet } from './myPilot'
import { coreContent } from './coreContent'

// mechData also loads the catalogues, which needs Supabase; these tests don't.
vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

describe('allowedSizes', () => {
  it('fits weapons to each mount by size', () => {
    expect(allowedSizes('Main', 0, [null])).toEqual(['Main', 'Auxiliary'])
    expect(allowedSizes('Heavy', 0, [null])).toEqual(['Superheavy', 'Heavy', 'Main', 'Auxiliary'])
    expect(allowedSizes('Aux/Aux', 1, [null, null])).toEqual(['Auxiliary'])
    expect(allowedSizes('Main/Aux', 1, ['Main', null])).toEqual(['Auxiliary'])
    expect([mountSize('Main'), mountSize('Flex'), mountSize('Aux/Aux')]).toEqual([1, 2, 2])
  })

  it('lets a Flex mount hold one Main weapon or two Auxiliary ones', () => {
    expect(allowedSizes('Flex', 0, [null, null])).toEqual(['Main', 'Auxiliary'])
    expect(allowedSizes('Flex', 1, ['Main', null])).toEqual([])
    expect(allowedSizes('Flex', 1, ['Auxiliary', null])).toEqual(['Auxiliary'])
    expect(allowedSizes('Flex', 0, [null, 'Auxiliary'])).toEqual(['Auxiliary'])
  })
})

describe('mechStats', () => {
  const blackbeard: Frame = {
    id: 'mf_blackbeard',
    name: 'Blackbeard',
    source: 'IPS-N',
    licenceLevel: 2,
    integrated: [],
    mechtype: ['Striker'],
    mounts: ['Flex', 'Main', 'Heavy'],
    stats: { structure: 4, stress: 4, armor: 1, hp: 12, evasion: 8, heatcap: 4, repcap: 5, sp: 5, speed: 5, edef: 6, tech_attack: -2 },
    description: '',
  }
  const value = (stats: ReturnType<typeof mechStats>, id: string) => stats.find((stat) => stat.id === id)!.value

  it('adds the pilot\'s HASE to the frame, with no grit', () => {
    const stats = mechStats(blackbeard, { hull: 3, agility: 2, systems: 5, engineering: 1 })
    expect(value(stats, 'hp')).toBe(18)
    expect(value(stats, 'repair')).toBe(6)
    expect(value(stats, 'evasion')).toBe(10)
    expect(value(stats, 'heat')).toBe(5)
    expect(value(stats, 'system_points')).toBe(7)
    expect(value(stats, 'structure')).toBe(4)
    expect(value(stats, 'speed')).toBe(6)
    expect(value(stats, 'edef')).toBe(11)
    expect(value(stats, 'tech_attack')).toBe(3)
    expect(value(mechStats(blackbeard, { agility: 1 }), 'speed')).toBe(5)
  })

  it('counts unset skills as 0, and shows nothing without a frame', () => {
    expect(value(mechStats(blackbeard, undefined), 'hp')).toBe(12)
    expect(mechStats(null, undefined).every((stat) => stat.value === null)).toBe(true)
  })

  const catalogue: EffectCatalogue = {
    frames: [blackbeard], weapons: new Map(), integrated: new Map(),
    systems: new Map([
      ['personal', toItem('personal', { name: 'Personalizations', tags: [{ id: 'tg_unique' }], bonuses: [{ id: 'hp', val: 2 }] })],
      ['capacity', toItem('capacity', { name: 'Capacity', bonuses: [{ id: 'sp', val: 2 }] })],
    ]),
    coreBonuses: [
      { id: 'reinforced', name: 'Reinforced Frame', source: 'IPS-N', effect: 'You gain +5 HP.', bonuses: [{ id: 'hp', val: 5 }] },
      { id: 'superior', name: 'Superior by Design', source: 'HA', effect: 'Immunity to Impaired; +2 Heat Cap.', bonuses: [{ id: 'heatcap', val: 2 }] },
    ],
    talents: [{ id: 'test', name: 'Test talent', terse: '', ranks: [
      { name: 'First', description: 'First rank.', bonuses: [{ id: 'repcap', val: 1 }] },
      { name: 'Second', description: 'Second rank.', bonuses: [{ id: 'hp', val: 3 }] },
      { name: 'Third', description: 'Third rank.', bonuses: [{ id: 'speed', val: 1 }] },
    ] }],
  }

  it('stacks equipped bonuses, core bonuses and all purchased talent ranks, with named sources', () => {
    const sheet: Sheet = { mech_skills: { hull: 2 }, core_bonuses: ['reinforced', 'reinforced', 'superior'], talents: { test: 2 } }
    const effects = mechEffects({ systems: ['personal', 'personal', 'capacity'] }, sheet, catalogue)
    const stats = mechStats(blackbeard, sheet.mech_skills, effects.modifiers)
    expect(value(stats, 'hp')).toBe(26)
    expect(value(stats, 'heat')).toBe(6)
    expect(value(stats, 'repair')).toBe(7)
    expect(value(stats, 'system_points')).toBe(7)
    expect(value(stats, 'speed')).toBe(5)
    expect(stats.find(stat => stat.id === 'hp')!.contributors).toEqual([
      'Blackbeard: 12', 'hull: +4', 'Personalizations: +2', 'Reinforced Frame: +5', 'Test talent 2: Second: +3',
    ])
    expect(effects.reminders).toContainEqual({ source: 'Superior by Design', text: 'Immunity to Impaired; +2 Heat Cap.' })
    const reduced = mechEffects({}, { talents: { test: 1 } }, catalogue)
    expect(value(mechStats(blackbeard, undefined, reduced.modifiers), 'hp')).toBe(12)
    expect(value(mechStats(blackbeard, undefined, reduced.modifiers), 'repair')).toBe(6)
  })

  it('applies the official Personalizations and Reinforced Frame data', () => {
    const personal = coreContent.items.find(item => item.id === 'ms_personalizations')!
    const reinforced = coreContent.items.find(item => item.id === 'cb_reinforced_frame')!
    const effects = mechEffects({ systems: [personal.id] }, { core_bonuses: [reinforced.id] }, {
      ...catalogue,
      systems: new Map([[personal.id, toItem(personal.id, personal.data)]]),
      coreBonuses: [reinforced.data as unknown as NonNullable<EffectCatalogue['coreBonuses']>[number]],
    })
    expect(value(mechStats(blackbeard, { hull: 2 }, effects.modifiers), 'hp')).toBe(23)
  })

  it('keeps conditions, expressions, filters and unsupported stats out of totals and in reminders', () => {
    const system = toItem('conditional', { name: 'Conditional', bonuses: [
      { id: 'hp', val: 10, condition: '{exposed}' }, { id: 'hp', val: '{ll}' },
      { id: 'hp', val: 10, weapon_types: ['Rifle'] }, { id: 'drone_hp', val: 5 },
      { id: 'hp', val: true }, { id: 'hp', val: null }, { id: 'tech_attack', val: 2, accuracy: 1 },
      { id: 'hp', val: 2, detail: 'Only while braced.' }, { id: 'hp', val: Infinity },
      { id: 'heat_cap', val: '2' },
    ] })
    const effects = mechEffects({ systems: ['conditional'] }, {}, { ...catalogue, systems: new Map([['conditional', system]]) })
    expect(effects.modifiers).toEqual([
      { stat: 'hp', source: 'Conditional', value: 0, replace: false, overwrite: false },
      { stat: 'heat', source: 'Conditional', value: 2, replace: false, overwrite: false },
    ])
    expect(effects.reminders).toHaveLength(6)
    expect(effects.reminders[0].text).toContain('condition: {exposed}')
  })

  it('only counts equipped weapons and integrated items once, with missing content made explicit', () => {
    const weapon = toItem('weapon', { name: 'Weapon', bonuses: [{ id: 'hp', val: 1 }] })
    const builtIn = toItem('builtin', { name: 'Built in', bonuses: [{ id: 'hp', val: 2 }] })
    const effects = mechEffects({ frame: blackbeard.id, systems: ['builtin', 'missing'], mounts: [['weapon', 'weapon'], [], [], ['weapon']] }, {}, {
      ...catalogue, frames: [{ ...blackbeard, mounts: ['Main', 'Main', 'Heavy'], integrated: ['builtin'] }],
      weapons: new Map([['weapon', weapon]]), integrated: new Map([['builtin', builtIn]]),
    })
    expect(value(mechStats(blackbeard, undefined, effects.modifiers), 'hp')).toBe(15)
    expect(effects.reminders).toContainEqual({ source: 'missing', text: 'Content unavailable; its bonuses are not included.' })
  })

  it('handles replacement and overwrite precedence without crediting discarded bonuses', () => {
    const modifier = (source: string, value: number, replace = false, overwrite = false): StatModifier => ({ stat: 'hp', source, value, replace, overwrite })
    const modifiers = [modifier('add', 4), modifier('replace A', 3, true), modifier('replace B', 2, true), modifier('override A', 5, false, true), modifier('override B', 2, false, true)]
    const stats = mechStats(blackbeard, undefined, modifiers)
    expect(value(stats, 'hp')).toBe(10)
    expect(stats.find(stat => stat.id === 'hp')!.contributors).toEqual(['replace A: sets base to 3', 'replace B: sets base to 2', 'override A: +5 (highest override)'])
    expect(value(mechStats(blackbeard, undefined, [...modifiers, modifier('final', 2, true, true)]), 'hp')).toBe(2)
    expect(value(mechStats(blackbeard, undefined, [modifier('add', 4), modifier('replace', 3, true)]), 'hp')).toBe(7)
  })

  it('caps armour at four, preserves negative tech attack and waits for a frame', () => {
    const modifiers = [{ stat: 'armour', source: 'Plating', value: 5, replace: false, overwrite: false }]
    const stats = mechStats(blackbeard, undefined, modifiers)
    expect(value(stats, 'armour')).toBe(4)
    expect(stats.find(stat => stat.id === 'armour')!.contributors).toContain('armour maximum: 4')
    expect(value(stats, 'tech_attack')).toBe(-2)
    expect(mechStats(null, undefined, modifiers).every(stat => stat.value === null && !stat.contributors.length)).toBe(true)
  })
})
