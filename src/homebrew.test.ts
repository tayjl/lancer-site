import { describe, expect, it, vi } from 'vitest'
import { toItem, pilotVitals, sheetStats, type Bionic, type CoreBonus, type Talent } from './gameData'
import { buildFrame, mechEffects, mechResources, mountReplacements, type EffectCatalogue, type Frame } from './mechData'
import { equipmentDetails } from './equipment'
import { problemsFor } from './contentEditor'
import { mechProblems, modPointLimit, pilotProblems, requirementReason, unmetRequirements } from './rules'
import { personalStatIds, type NamedBonus } from './bonuses'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const frame = (extra: Record<string, unknown> = {}): Frame => {
  const raw = { name: 'Test', mounts: ['Main', 'Main'], stats: { size: 1, structure: 4, stress: 4, hp: 10, armor: 0, evasion: 8, edef: 8, heatcap: 6, repcap: 5, speed: 4, tech_attack: 0, sp: 10 }, ...extra }
  return { id: 'mf_test', name: 'Test', source: 'GMS', licenceLevel: 0, integrated: [], mechtype: [], mounts: raw.mounts as string[], stats: raw.stats as Record<string, number>, description: '', raw }
}
const item = (id: string, data: Record<string, unknown> = {}) => toItem(id, { name: id, mount: 'Main', type: 'Rifle', range: [{ type: 'Range', val: 10 }], damage: [{ type: 'Kinetic', val: 5 }], tags: [], ...data })
const catalogue = (over: Partial<EffectCatalogue & { frames: Frame[] }> = {}) => ({ frames: [frame()], weapons: new Map<string, ReturnType<typeof item>>(), systems: new Map<string, ReturnType<typeof item>>(), integrated: new Map<string, ReturnType<typeof item>>(), ...over })
const named = (id: string, val: unknown, extra: Record<string, unknown> = {}): NamedBonus => ({ source: 'Test', bonus: { id, val: val as number, ...extra } })

describe('replace_mount', () => {
  const retrofit = { id: 'cb_swap', name: 'Swap', source: 'GMS', effect: '', bonuses: [{ id: 'replace_mount', val: 'Heavy' }] } as CoreBonus
  const sheet = { core_bonuses: ['cb_swap'] }
  it('replaces the chosen mount and lists a choice keyed by its source', () => {
    const effects = mechEffects({ frame: 'mf_test', core_mounts: { cb_swap: 1 } }, sheet, catalogue({ coreBonuses: [retrofit] }))
    expect(effects.frame!.mounts).toEqual(['Main', 'Heavy'])
    expect(mountReplacements(effects.bonuses)).toEqual([{ key: 'cb_swap', name: 'Swap', type: 'Heavy' }])
  })
  it('ignores a missing, out-of-range or integrated choice, and the rule check says so', () => {
    for (const core_mounts of [{}, { cb_swap: 9 }, { cb_swap: -1 }] as Record<string, number>[]) {
      const mech = { frame: 'mf_test', core_mounts }
      expect(mechEffects(mech, sheet, catalogue({ coreBonuses: [retrofit] })).frame?.mounts).toEqual(['Main', 'Main'])
      expect(mechProblems(mech, sheet, catalogue({ coreBonuses: [retrofit] }))).toContain('Swap needs a normal mount.')
    }
    expect(buildFrame(frame({ mounts: ['Main'] }), { core_mounts: { cb_swap: 1 } }, sheet, [], [{ source: 'Swap', key: 'cb_swap', bonus: { id: 'replace_mount', val: 'Heavy' } }])?.mounts).toEqual(['Main'])
  })
  it('keeps the old Mount Retrofitting choice working', () => {
    expect(buildFrame(frame(), { core_mounts: { cb_mount_retrofitting: 0 } }, { core_bonuses: ['cb_mount_retrofitting'] }, [])?.mounts).toEqual(['Main/Aux', 'Main'])
  })
})

describe('grants from equipped items and biomods', () => {
  const grantor = item('ms_grantor', { type: 'System', mount: '', special_equipment: ['ms_extra'], integrated: ['mw_gift'], replace_integrated: true })
  const gift = item('mw_gift'), extra = item('ms_extra', { type: 'System', mount: '' })
  const cat = (bionics: Bionic[] = []) => catalogue({ frames: [frame({ integrated: undefined })], systems: new Map([[grantor.id, grantor]]), integrated: new Map([[gift.id, gift], [extra.id, extra]]), bionics })
  it('builds in what an equipped system grants and unlocks its optional items', () => {
    const mech = { frame: 'mf_test', systems: ['ms_grantor', 'ms_extra'] }
    expect(mechEffects(mech, {}, cat()).frame!.integrated).toContain('mw_gift')
    expect(mechProblems(mech, {}, cat())).not.toContain('ms_extra needs ms_grantor.')
  })
  it('names the missing source when the granting item is gone', () => {
    expect(mechProblems({ frame: 'mf_test', systems: ['ms_extra'] }, {}, cat())).toContain('ms_extra needs ms_grantor.')
  })
  it('lets an installed biomod grant equipment', () => {
    const bionic = { id: 7, name: 'Implant', special_equipment: ['ms_extra'] } as unknown as Bionic
    expect(mechProblems({ frame: 'mf_test', systems: ['ms_extra'] }, { bionics: [7] }, cat([bionic]))).not.toContain('ms_extra needs Implant.')
    expect(mechProblems({ frame: 'mf_test', systems: ['ms_extra'] }, { bionics: [] }, cat([bionic]))).toContain('ms_extra needs ms_grantor or Implant.')
  })
})

describe('weapon modifiers', () => {
  const rifle = item('r')
  const details = (bonuses: NamedBonus[]) => equipmentDetails(rifle, {}, bonuses)
  it('adds a damage type as a new entry, or onto the weapon\'s own', () => {
    expect(details([named('damage', 2, { damage_type: 'Heat' })]).damage).toEqual([{ type: 'Kinetic', val: 5 }, { type: 'Heat', val: 2 }])
    expect(details([named('damage', 2, { damage_type: 'Kinetic' })]).damage).toEqual([{ type: 'Kinetic', val: 7 }])
    expect(details([named('damage', 1)]).damage[0].val).toBe(6)
  })
  it('filters by weapon size and damage type, and names each change', () => {
    expect(details([named('range', 3, { weapon_sizes: ['Heavy'] })]).range[0].val).toBe(10)
    const result = details([named('range', 3, { weapon_sizes: ['Main'], damage_types: ['Kinetic'] })])
    expect(result.range[0].val).toBe(13)
    expect(result.sources).toContain('Test: +3 range')
  })
  it('adds tags once', () => {
    const result = details([named('add_tags', [{ id: 'tg_ap' }, { id: 'tg_limited', val: 2 }], { weapon_types: ['Rifle'] }), named('add_tags', [{ id: 'tg_ap' }])])
    expect(result.tags).toEqual([{ id: 'tg_ap' }, { id: 'tg_limited', val: 2 }])
  })
  it('names a conditional modifier without counting it', () => {
    const result = details([named('range', 3, { condition: 'exposed' })])
    expect(result.range[0].val).toBe(10)
    expect(result.sources).toContain('Test: +3 range, only when exposed. Not counted.')
  })
})

describe('resources and deployables', () => {
  const effects = (...bonuses: NamedBonus[]) => ({ modifiers: [], bonuses })
  it('takes structure repair cost from the bonus value', () => {
    expect(mechResources({}, effects()).structureRepairs).toBe(2)
    expect(mechResources({}, effects(named('cheap_struct', 1))).structureRepairs).toBe(1)
    expect(mechResources({}, effects(named('cheap_struct', 0))).structureRepairs).toBe(0)
    expect(mechResources({}, effects(named('cheap_struct', 3), named('cheap_struct', 4))).structureRepairs).toBe(3)
    expect(mechResources({}, effects(named('cheap_struct', -1))).structureRepairs).toBe(2)
  })
  it('applies drone and deployable stats, drones only for drone_*', () => {
    const turret = item('t', { type: 'Deployable', deployables: [{ name: 'Gun', type: 'Drone', hp: 5, armor: 0, size: 1, evasion: 10, edef: 8 }, { name: 'Mine', type: 'Mine', hp: 1 }] })
    const [drone, mine] = (equipmentDetails(turret, {}, [named('drone_armor', 2), named('deployable_hp', 1), named('drone_evasion', 2), named('drone_edef', -1), named('drone_size', 1)]).raw!.deployables as Record<string, number>[])
    expect(drone).toMatchObject({ armor: 2, hp: 6, evasion: 12, edef: 7, size: 2 })
    expect(mine).toMatchObject({ hp: 2 })
  })
})

describe('bonuses on every source', () => {
  it('counts talent, core, gear and biomod bonuses on the five personal stats and mod points', () => {
    const talents = [{ id: 't', name: 'T', terse: '', ranks: [{ name: 'I', description: '', bonuses: [{ id: 'physicality', val: 1 }, { id: 'mod_points', val: 2 }] }] }] as Talent[]
    const bionic = { id: 1, name: 'Implant', bonuses: [], effect_bonuses: [{ id: 'acuity', val: 1 }, { id: 'pilot_hp', val: 3 }] } as unknown as Bionic
    const sheet = { talents: { t: 1 }, bionics: [1] }
    const stats = sheetStats(sheet, [{ id: 'physicality', name: 'Physicality' }, { id: 'acuity', name: 'Acuity' }], [bionic], [named('physicality', 1), named('acuity', 1)])
    expect(stats.personal.map(stat => stat.bonus)).toEqual([1, 1])
    expect(modPointLimit(2, sheet, [], talents, [], [bionic])).toBe(10)
    expect(pilotVitals(sheet, [], talents, [], [bionic]).find(stat => stat.id === 'pilot_hp')!.value).toBe(9)
  })
  it('shows a conditional pilot bonus without counting it', () => {
    const stats = sheetStats({}, [{ id: 'physicality', name: 'Physicality' }], [], [named('physicality', 2, { condition: 'wounded' })])
    expect(stats.personal[0].bonus).toBe(0)
    expect(stats.personal[0].contributors).toEqual(['Test: +2 physicality, only when wounded. Not counted.'])
  })
  it('keeps pilot and personal bonuses off the mech', () => {
    personalStatIds.value = new Set(['physicality'])
    const talents = [{ id: 't', name: 'T', terse: '', ranks: [{ name: 'I', description: '', bonuses: [{ id: 'physicality', val: 1 }, { id: 'pilot_hp', val: 1 }] }] }] as Talent[]
    expect(mechEffects({ frame: 'mf_test' }, { talents: { t: 1 } }, catalogue({ talents })).reminders.filter(entry => entry.uncounted)).toEqual([])
  })
})

describe('requirements', () => {
  const sheet = { talents: { t_brawler: 2 }, licences: { mf_tortuga: 1 }, core_bonuses: ['cb_x'] }
  const names = { talents: [{ id: 't_brawler', name: 'Brawler' }] as Talent[], frames: [{ id: 'mf_tortuga', name: 'Tortuga', source: 'HORUS' }] as Frame[], itemName: (id: string) => (id === 'sys' ? 'Integrated Weapon' : undefined) }
  const need = (...requires: unknown[]) => unmetRequirements({ requires }, sheet, ['own'], names)
  it('names what is missing', () => {
    expect(need({ kind: 'talent', id: 't_brawler', rank: 2 }, { kind: 'licence', id: 'mf_tortuga', rank: 1 }, { kind: 'core_bonus', id: 'cb_x' }, { kind: 'item', id: 'own' })).toEqual([])
    expect(need({ kind: 'talent', id: 't_brawler', rank: 3 })).toEqual(['Brawler III'])
    expect(need({ kind: 'licence', id: 'mf_tortuga', rank: 2 })).toEqual(['HORUS Tortuga II'])
    expect(need({ kind: 'item', id: 'sys' }, { kind: 'core_bonus', id: 'cb_y' })).toEqual(['Integrated Weapon', 'cb_y'])
    expect(requirementReason(need({ kind: 'talent', id: 't_brawler', rank: 3 }))).toBe('Needs Brawler III')
    expect(requirementReason([])).toBe('')
  })
  it('ignores malformed entries', () => {
    expect(need(null, { kind: 'bogus', id: 'x' }, { kind: 'item' })).toEqual([])
    expect(unmetRequirements({ requires: 'nope' }, sheet, [])).toEqual([])
  })
  it('reports a saved mech whose item needs something it lacks', () => {
    const picky = item('ms_picky', { type: 'System', mount: '', requires: [{ kind: 'item', id: 'ms_other' }] })
    const problems = mechProblems({ frame: 'mf_test', systems: ['ms_picky'] }, {}, catalogue({ systems: new Map([['ms_picky', picky]]) }))
    expect(problems).toContain('ms_picky needs ms_other.')
  })
  it('reports a talent, core bonus and gear that need a rank the pilot lacks', () => {
    const talent = { id: 't_a', name: 'A', terse: '', ranks: [], requires: [{ kind: 'talent', id: 't_brawler', rank: 3 }] } as unknown as Talent
    const gear = item('g', { type: 'Gear', requires: [{ kind: 'core_bonus', id: 'cb_z' }] })
    const problems = pilotProblems({ talents: { t_a: 1, t_brawler: 2 }, owned_gear: [{ key: 'k', id: 'g' }] }, { level: 5, manna: 99999 }, { ...catalogue(), talents: [talent, ...names.talents.map(t => ({ ...t, ranks: [] }))] as Talent[], gear: [gear] }, {}, null)
    expect(problems).toContain('A needs Brawler III.')
    expect(problems).toContain('g needs cb_z.')
  })
})

describe('editor checks for the new fields', () => {
  const ctx = { id: 'x', tags: new Map([['tg_ap', 'AP']]), statIds: [], known: new Set(['ms_a']), licences: new Set(['mf_a']), talents: new Set(['t_a']), coreBonuses: new Set(['cb_a']) }
  const check = (kind: 'systems' | 'weapons', extra: Record<string, unknown>) => problemsFor(kind, { id: 'x', name: 'X', ...extra }, ctx).map(problem => problem.text)
  it('accepts the new bonus ids and rejects bad values', () => {
    expect(check('systems', { bonuses: [{ id: 'cheap_struct', val: 0 }, { id: 'replace_mount', val: 'Heavy' }, { id: 'drone_armor', val: 1 }, { id: 'add_tags', val: [{ id: 'tg_ap' }], weapon_sizes: ['Main'] }, { id: 'damage', val: 2, damage_type: 'Heat', damage_types: ['Kinetic'] }] })).toEqual([])
    expect(check('systems', { bonuses: [{ id: 'cheap_struct', val: -1 }] })).toEqual(['Effect 1 needs a whole number, 0 or more.'])
    expect(check('systems', { bonuses: [{ id: 'add_tags', val: [] }] })).toEqual(['Effect 1 needs at least one tag.'])
    expect(check('systems', { bonuses: [{ id: 'damage', val: 1, damage_type: 'Fire' }] })).toEqual(['Effect 1 has an unknown damage type.'])
    expect(check('systems', { bonuses: [{ id: 'range', val: 1, weapon_sizes: ['Huge'] }] })).toEqual(['Effect 1 has an unknown weapon size.'])
  })
  it('checks requirements, and what systems and weapons grant', () => {
    expect(check('weapons', { mount: 'Main', type: 'Rifle', requires: [{ kind: 'talent', id: 't_a', rank: 2 }, { kind: 'licence', id: 'mf_a', rank: 1 }, { kind: 'core_bonus', id: 'cb_a' }, { kind: 'item', id: 'ms_a' }] })).toEqual([])
    expect(check('weapons', { mount: 'Main', type: 'Rifle', requires: [{ kind: 'x', id: 'a' }, { kind: 'item' }, { kind: 'talent', id: 't_a', rank: 4 }, { kind: 'core_bonus', id: 'nope' }] }))
      .toEqual(['Requirement 1 needs a kind.', 'Requirement 2 needs choosing.', 'Requirement 3 needs a rank, I, II or III.', 'Requirement 4: Core bonus "nope" doesn\'t exist.'])
    expect(check('systems', { integrated: ['gone'], replace_integrated: 'yes' })).toEqual(['Item "gone" doesn\'t exist.', 'Replace integrated must be yes or no.'])
  })
  it('checks a biomod\'s effect bonuses and requirements', () => {
    const text = problemsFor('bionics', { name: 'B', slot: 'Arm', source: 'X', manna_cost: 1, mod_point_cost: 1, bonuses: [], effect_bonuses: [{ id: 'cheap_struct', val: 'a' }], requires: [{ kind: 'item' }] }, ctx).map(problem => problem.text)
    expect(text).toEqual(['Effect 1 needs a whole number, 0 or more.', 'Requirement 1 needs choosing.'])
  })
})
