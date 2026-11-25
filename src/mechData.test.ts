import { describe, expect, it, vi } from 'vitest'
import { allowedSizes, grantingSources, mechEffects, mechResources, mechStats, mountSize, talentGrants, type EffectCatalogue, type Frame, type StatModifier } from './mechData'
import { personalStatIds } from './bonuses'
import { pilotBonuses, toItem, type Bionic } from './gameData'
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

  it('reads a frame core power check from its own field, else the official default, and ignores a malformed one', () => {
    const checks = (frame: Frame, raw: Record<string, unknown>) =>
      mechEffects({ frame: frame.id }, {}, { ...catalogue, frames: [{ ...frame, raw }] }).bonuses.filter((entry) => entry.bonus.accuracy !== undefined).map((entry) => `${entry.bonus.id}:${entry.bonus.accuracy}`)
    const home = { ...blackbeard, id: 'hb_home' }
    expect(checks(home, { core_system: { name: 'C', check_bonuses: [{ id: 'hull', accuracy: 1, val: 0 }] } })).toEqual(['hull:1'])
    expect(checks(home, { core_system: { name: 'C' } })).toEqual([])
    expect(checks(blackbeard, { core_system: { name: 'C' } })).toEqual(['engineering:-1'])
    expect(checks(blackbeard, { core_system: { name: 'C', check_bonuses: [] } })).toEqual([])
    expect(checks(blackbeard, { core_system: { name: 'C', check_bonuses: 'junk' } })).toEqual(['engineering:-1'])
    expect(checks(home, { core_system: { name: 'C', check_bonuses: [null, 5, { accuracy: 1 }, { id: 'agility', accuracy: -1, val: 0 }] } })).toEqual(['agility:-1'])
  })

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
      'Base: 12', 'Hull: +4', 'Personalizations: +2', 'Reinforced Frame: +5', 'Test talent 2: Second: +3',
    ])
    expect(effects.reminders).toContainEqual(expect.objectContaining({ source: 'Superior by Design', text: 'Immunity to Impaired; +2 Heat Cap.' }))
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

  it('reminds about a pilot effect nobody declared, and stays quiet about the pilot stats', () => {
    const system = toItem('odd', { name: 'Odd', bonuses: [{ id: 'pilot_foo', val: 2 }, { id: 'pilot_hp', val: 1 }] })
    const effects = mechEffects({ systems: ['odd'] }, {}, { ...catalogue, systems: new Map([['odd', system]]) })
    expect(effects.reminders).toEqual([expect.objectContaining({ kind: 'item', name: 'Odd', text: '+2 pilot foo.', uncounted: true })])
  })

  describe('biomods', () => {
    const arm = { id: 1, name: 'Arm', effect: '<p>Strong.</p>', effect_bonuses: [{ id: 'physicality', val: 2 }], integrated: ['mw_knife'] } as unknown as Bionic
    const sheet: Sheet = { bionics: [1] }
    personalStatIds.value = new Set(['physicality'])
    it('adds a personal stat effect to the pilot and still grants its weapon', () => {
      expect(pilotBonuses(sheet, [], [], [], [arm]).map(entry => [entry.source, entry.bonus.id, entry.bonus.val])).toEqual([['Arm', 'physicality', 2]])
      expect([...talentGrants(sheet, [], [], grantingSources({}, sheet, { ...catalogue, bionics: [arm] })).integrated]).toEqual(['mw_knife'])
      expect(mechEffects({}, sheet, { ...catalogue, bionics: [arm] }).reminders).toEqual([])
    })
    it('grants without a stat effect, and adds a stat effect without a grant', () => {
      const grantOnly = { ...arm, effect_bonuses: [] } as Bionic, statOnly = { ...arm, integrated: [] } as Bionic
      expect(pilotBonuses(sheet, [], [], [], [grantOnly])).toEqual([])
      expect([...talentGrants(sheet, [], [], grantingSources({}, sheet, { ...catalogue, bionics: [grantOnly] })).integrated]).toEqual(['mw_knife'])
      expect(pilotBonuses(sheet, [], [], [], [statOnly])).toHaveLength(1)
      expect(talentGrants(sheet, [], [], grantingSources({}, sheet, { ...catalogue, bionics: [statOnly] })).integrated).toEqual([])
    })
    it('shows a biomod action as a biomod reminder, without repeating its rules text', () => {
      const eye = { ...arm, actions: [{ name: 'Flash', activation: 'Quick', detail: 'Blind a target.' }] } as unknown as Bionic
      const { reminders } = mechEffects({}, sheet, { ...catalogue, bionics: [eye] })
      expect(reminders).toEqual([expect.objectContaining({ kind: 'biomod', name: 'Flash', activation: 'Quick', text: 'Blind a target.' })])
    })
  })

  it('reminds about the bonuses of an active core power', () => {
    const raw = { core_system: { name: 'Core', active_name: 'Surge', active_effect: 'Go.', active_bonuses: [{ id: 'hp', val: 5 }, { id: 'speed', val: 1, condition: '{moving}' }] } }
    const power = mechEffects({ frame: blackbeard.id }, {}, { ...catalogue, frames: [{ ...blackbeard, raw }] }).reminders.filter((entry) => entry.kind === 'core-power')
    expect(power).toEqual([expect.objectContaining({ name: 'Surge', text: 'Go.<br>While active, not counted in the stats: +5 hp. +1 speed, only when moving.' })])
    expect(power[0].uncounted).toBeUndefined()
  })

  it('words a minimum range bonus of an active core power as a minimum', () => {
    const raw = { core_system: { name: 'Core', active_name: 'Surge', active_effect: 'Go.', active_bonuses: [{ id: 'min_range', val: 3, range_types: ['Threat'] }] } }
    const power = mechEffects({ frame: blackbeard.id }, {}, { ...catalogue, frames: [{ ...blackbeard, raw }] }).reminders.find((entry) => entry.kind === 'core-power')
    expect(power?.text).toBe('Go.<br>While active, not counted in the stats: Threat range is at least 3.')
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
    expect(effects.reminders[0]).toMatchObject({ kind: 'item', name: 'Conditional', text: '+10 hp, only when exposed.', uncounted: true })
  })

  it('leaves pilot gear and equipped items’ own rules out of the reminders', () => {
    const gear = toItem('jacket', { name: 'Jacket', type: 'Armor', description: 'A jacket.', bonuses: [{ id: 'pilot_hp', val: 2 }], actions: [{ name: 'Zip', detail: 'Zip up.' }] })
    const system = toItem('described', { name: 'Described', effect: 'Does a thing.', actions: [{ name: 'Act', detail: 'Act now.' }] })
    const effects = mechEffects({ systems: ['described'] }, { owned_gear: [{ key: 'k', id: 'jacket' }], equipped_gear: ['k'] }, { ...catalogue, gear: [gear], systems: new Map([['described', system]]) })
    expect(effects.reminders).toEqual([])
  })

  it('only counts equipped weapons and integrated items once, with missing content made explicit', () => {
    const weapon = toItem('weapon', { name: 'Weapon', bonuses: [{ id: 'hp', val: 1 }] })
    const builtIn = toItem('builtin', { name: 'Built in', bonuses: [{ id: 'hp', val: 2 }] })
    const effects = mechEffects({ frame: blackbeard.id, systems: ['builtin', 'missing'], mounts: [['weapon', 'weapon'], [], [], ['weapon']] }, {}, {
      ...catalogue, frames: [{ ...blackbeard, mounts: ['Main', 'Main', 'Heavy'], integrated: ['builtin'] }],
      weapons: new Map([['weapon', weapon]]), integrated: new Map([['builtin', builtIn]]),
    })
    expect(value(mechStats(blackbeard, undefined, effects.modifiers), 'hp')).toBe(15)
    expect(effects.reminders).toContainEqual(expect.objectContaining({ kind: 'missing', source: 'missing', text: "Missing item. Its bonuses aren't counted." }))
  })

  it('handles replacement and overwrite precedence without crediting discarded bonuses', () => {
    const modifier = (source: string, value: number, replace = false, overwrite = false): StatModifier => ({ stat: 'hp', source, value, replace, overwrite })
    const modifiers = [modifier('add', 4), modifier('replace A', 3, true), modifier('replace B', 2, true), modifier('override A', 5, false, true), modifier('override B', 2, false, true)]
    const stats = mechStats(blackbeard, undefined, modifiers)
    expect(value(stats, 'hp')).toBe(10)
    expect(stats.find(stat => stat.id === 'hp')!.contributors).toEqual(['replace A: sets to 3', 'replace B: sets to 2', 'override A: +5 (highest wins)'])
    expect(value(mechStats(blackbeard, undefined, [...modifiers, modifier('final', 2, true, true)]), 'hp')).toBe(2)
    expect(value(mechStats(blackbeard, undefined, [modifier('add', 4), modifier('replace', 3, true)]), 'hp')).toBe(7)
  })

  it('caps armour at four, preserves negative tech attack and waits for a frame', () => {
    const modifiers = [{ stat: 'armour', source: 'Plating', value: 5, replace: false, overwrite: false }]
    const stats = mechStats(blackbeard, undefined, modifiers)
    expect(value(stats, 'armour')).toBe(4)
    expect(stats.find(stat => stat.id === 'armour')!.contributors).toContain('Armour maximum: 4')
    expect(value(stats, 'tech_attack')).toBe(-2)
    expect(mechStats(null, undefined, modifiers).every(stat => stat.value === null && !stat.contributors.length)).toBe(true)
  })
})

describe('mechResources', () => {
  const none = { modifiers: [], bonuses: [], reminders: [] }
  it('shows overcharge heat as flat numbers, with no dice', () => {
    expect(mechResources({}, none).overcharge).toBe('1 → 2 → 4 → 6')
    const own = { ...none, bonuses: [{ source: 'Frame', bonus: { id: 'overcharge', val: ['1', '1d3', '1d6+2', 'odd'] as unknown as string } }] }
    expect(mechResources({}, own).overcharge).toBe('1 → 2 → 6 → odd')
  })
})
