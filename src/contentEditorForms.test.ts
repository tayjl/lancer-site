import { describe, expect, it } from 'vitest'
import { FRAME_STATS, blankItem, problemsFor, setProfiles, splitProfiles, type Context, type EditorKind } from './contentEditor'

// The checks behind the forms for weapons, systems, weapon mods, talents and manufacturers (src/components/editor/).
const ctx: Context = {
  id: 'hb_mw_x',
  tags: new Map([['tg_limited', 'Limited {VAL}'], ['tg_unique', 'Unique']]),
  statIds: ['physicality'],
  known: new Set(['mw_gun', 'ms_shield', 'mf_marrow', 'hb_mw_x']),
  licences: new Set(['mf_marrow']),
}
const weapon = { id: 'hb_mw_x', name: 'Cinder Lance', mount: 'Main', type: 'Rifle', source: 'SSC', license: 'Marrow', license_id: 'mf_marrow', license_level: 2, sp: 2, range: [{ type: 'Range', val: 10 }], damage: [{ type: 'Kinetic', val: '1d6+2' }] }
type Data = Record<string, unknown>
const found = (kind: EditorKind, data: Data, context = ctx) => problemsFor(kind, data, context).filter((p) => p.level === 'error')
const fields = (kind: EditorKind, data: Data) => found(kind, data).map((p) => p.field)

describe('new items of the form kinds', () => {
  it('start valid enough for the form and the preview, except for the name', () => {
    for (const kind of ['weapons', 'systems', 'mods'] as const) {
      expect(problemsFor(kind, { ...blankItem(kind, 'hb_mw_x'), name: 'Thing' }, ctx)).toEqual([])
    }
    expect(blankItem('talents', 'hb_t_x').ranks).toHaveLength(3)
    expect(blankItem('manufacturers', 'ignored')).toMatchObject({ id: '', logo: '' })
  })
})

describe('weapon checks', () => {
  it("accepts a complete weapon, and the data's own unusual values", () => {
    expect(found('weapons', weapon)).toEqual([])
    expect(found('weapons', { ...weapon, mount: 'Ship-class', type: 'Spool Weapon' })).toEqual([])
  })
  it('names the field each problem belongs to', () => {
    const broken = { ...weapon, name: '', mount: 'Huge', type: 'Spoon', sp: -1, license_level: 4, range: [{ type: 'Range', val: '' }], damage: [{ type: 'Kinetic', val: 'lots' }] }
    expect(fields('weapons', broken)).toEqual(['name', 'mount', 'type', 'sp', 'license_level', 'range.0.val', 'damage.0.val'])
  })
  it('wants a whole, non-negative number of system points', () => {
    expect(fields('weapons', { ...weapon, sp: 1.5 })).toEqual(['sp'])
    expect(fields('weapons', { ...weapon, sp: '' })).toEqual(['sp'])
    expect(fields('weapons', { ...weapon, sp: 0 })).toEqual([])
  })
  it('wants a licence that is a frame, at rank I to III; none is fine', () => {
    expect(fields('weapons', { ...weapon, license_id: 'mf_nope' })).toEqual(['license_id'])
    expect(fields('weapons', { ...weapon, license_id: 'mf_marrow', license_level: 0 })).toEqual(['license_level'])
    expect(found('weapons', { ...weapon, license: 'GMS', license_id: '', license_level: 0 })).toEqual([])
  })
  it('checks every profile, wherever it sits, and needs different names', () => {
    const profiles = [
      { name: 'Slug', range: [{ type: 'Range', val: 10 }], damage: [{ type: 'Kinetic', val: 6 }], tags: [{ id: 'tg_limited' }] },
      { name: 'slug', range: [{ type: 'Wave', val: 2 }], damage: [], actions: [{ name: '', activation: 'Free' }] },
      { name: '', range: [], damage: [] },
    ]
    const { range: _range, damage: _damage, ...top } = weapon
    const problems = found('weapons', { ...top, profiles })
    expect(problems.map((p) => p.field)).toEqual(['profiles.0.tags.0.val', 'profiles.1.name', 'profiles.1.range.0.type', 'profiles.1.actions.0.name', 'profiles.2.name'])
    expect(problems[0].text).toBe('Profile 1: Limited needs a number.')
    expect(problems[1].text).toBe('Profile names must differ: "slug" is used twice.')
    expect(problems[2].text).toBe('Profile 2: Range 1 needs a type.')
  })
  it("checks a deployable's name and numbers", () => {
    expect(found('weapons', { ...weapon, deployables: [{ name: 'Turret', type: 'Drone', hp: 5, size: 0.5, evasion: '' }] })).toEqual([])
    expect(fields('weapons', { ...weapon, deployables: [{ name: '', hp: -3, edef: 'x', actions: [{ name: '' }] }] })).toEqual(['deployables.0.name', 'deployables.0.hp', 'deployables.0.edef', 'deployables.0.actions.0.name'])
  })
  it('splits into profiles and folds one back up', () => {
    const split = splitProfiles({ ...weapon, on_hit: 'Stun.', effect: 'Shared.' })
    expect(split.profiles).toEqual([{ name: 'Standard', range: weapon.range, damage: weapon.damage, on_hit: 'Stun.' }, { name: 'Mode 2', range: [], damage: [] }])
    expect(split).not.toHaveProperty('range')
    expect(split).toMatchObject({ effect: 'Shared.', mount: 'Main' })
    const back = setProfiles(split, [(split.profiles as Data[])[1]])
    expect(back).not.toHaveProperty('profiles')
    expect(back).toMatchObject({ range: [], damage: [], effect: 'Shared.' })
    expect(setProfiles(split, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]).profiles).toHaveLength(3)
  })
})

describe('system and mod checks', () => {
  const system = { id: 'hb_mw_x', name: 'Shield', type: 'Shield', sp: 1, license_id: '', license_level: 0 }
  it('accepts a system with no type (the data has many), and refuses an unknown one', () => {
    expect(found('systems', { ...system, type: undefined })).toEqual([])
    expect(fields('systems', { ...system, type: 'Gizmo' })).toEqual(['type'])
  })
  it('checks the system points, tags, bonuses and actions', () => {
    expect(fields('systems', { ...system, sp: 'x', tags: [{ id: 'tg_limited' }], bonuses: [{ id: '', val: 1 }], actions: [{ name: ' ' }] })).toEqual(['sp', 'tags.0.val', 'bonuses.0.id', 'actions.0.name'])
  })
  it('checks what a mod adds', () => {
    expect(found('mods', { id: 'hb_mw_x', name: 'Mod', sp: 1, allowed_types: ['Rifle'], added_range: [{ type: 'Range', val: 2 }], added_damage: [{ type: 'Burn', val: '1d6' }], added_tags: [{ id: 'tg_unique' }] })).toEqual([])
    expect(fields('mods', { id: 'hb_mw_x', name: 'Mod', added_range: [{ type: 'Range' }], added_damage: [{ type: 'Fire', val: 1 }], added_tags: [{}] })).toEqual(['added_range.0.val', 'added_damage.0.type', 'added_tags.0'])
  })
})

describe('talent checks', () => {
  const rank = (name: string, more: Data = {}) => ({ name, description: 'Text.', ...more })
  const talent = { id: 'hb_mw_x', name: 'Ace', terse: 'Fly.', ranks: [rank('One'), rank('Two', { integrated: ['mw_gun'] }), rank('Three', { special_equipment: ['ms_shield'] })] }
  it('accepts three ranks that grant items that exist', () => {
    expect(found('talents', talent)).toEqual([])
  })
  it('needs exactly three named ranks', () => {
    expect(fields('talents', { ...talent, ranks: [rank('One'), rank('Two')] })).toEqual(['ranks'])
    expect(fields('talents', { ...talent, ranks: [rank(''), rank('Two'), rank('Three'), rank('Four')] })).toEqual(['ranks', 'ranks.0.name'])
  })
  it('refuses granted items that do not exist, but only when it knows which do', () => {
    const missing = { ...talent, ranks: [rank('One', { integrated: ['mw_nope'] }), rank('Two', { special_equipment: ['ms_shield', 'ms_nope'] }), rank('Three')] }
    expect(found('talents', missing).map((p) => [p.field, p.text])).toEqual([
      ['ranks.0.integrated', 'Rank I: Item "mw_nope" doesn\'t exist.'],
      ['ranks.1.special_equipment', 'Rank II: Item "ms_nope" doesn\'t exist.'],
    ])
    expect(found('talents', missing, { ...ctx, known: undefined })).toEqual([])
  })
  it("checks a rank's actions and bonuses", () => {
    expect(fields('talents', { ...talent, ranks: [rank('One', { actions: [{ name: '' }], bonuses: [{ id: 'hp', val: 'x' }] }), rank('Two'), rank('Three')] })).toEqual(['ranks.0.bonuses.0.val', 'ranks.0.actions.0.name'])
  })
})

describe('manufacturer checks', () => {
  const maker = { id: 'hb_mw_x', name: 'Corvid', dark: '#1c9ae8', light: '#0c4d99', logo: '' }
  it('accepts a code and two hex colours', () => {
    expect(found('manufacturers', maker)).toEqual([])
    expect(found('manufacturers', { ...maker, light: '' })).toEqual([])
  })
  it('wants a plain hex colour for the main colour, the one the site draws', () => {
    expect(fields('manufacturers', { ...maker, dark: 'blue' })).toEqual(['dark'])
    expect(fields('manufacturers', { ...maker, dark: '#abc' })).toEqual(['dark'])
    expect(fields('manufacturers', { ...maker, dark: '' })).toEqual(['dark'])
    expect(fields('manufacturers', { ...maker, light: 'rgb(0,0,0)' })).toEqual(['light'])
  })
  it('wants an id that is a short code', () => {
    const bad = { ...maker, id: 'Not a code!' }
    expect(found('manufacturers', bad, { ...ctx, id: 'Not a code!' }).map((p) => p.field)).toEqual(['id'])
    expect(found('manufacturers', { ...maker, id: 'IPS-N' }, { ...ctx, id: 'IPS-N' })).toEqual([])
  })
})

describe('frame checks', () => {
  const frameCtx: Context = { ...ctx, id: 'hb_mf_x', known: new Set([...ctx.known!, 'hb_mf_x']) }
  const frame: Data = {
    ...blankItem('frames', 'hb_mf_x'), name: 'Pallbearer', source: 'SSC', license_level: 2, mechtype: ['Support'],
    mounts: ['Flex', 'Main', 'Aux/Aux'], traits: [{ name: 'Slow Burn', description: 'x' }],
    core_system: { name: 'Ossuary Engine', active_name: 'Wake', active_effect: 'x', activation: 'Quick', integrated: ['mw_gun'] },
  }
  const frameFields = (data: Data) => found('frames', data, frameCtx).map((p) => p.field)

  it('starts valid once it has a name and a core system name, and accepts a complete frame', () => {
    const blank = blankItem('frames', 'hb_mf_x')
    expect(found('frames', blank, frameCtx).map((p) => p.field)).toEqual(['name', 'core_system.name'])
    expect(found('frames', { ...blank, name: 'Thing', core_system: { name: 'Core' } }, frameCtx)).toEqual([])
    expect(found('frames', frame, frameCtx)).toEqual([])
  })
  it('wants every stat as a number, whole and not below 0 (tech attack may be), and a size of ½, 1, 2 or 3', () => {
    const stats = frame.stats as Data
    expect(frameFields({ ...frame, stats: { ...stats, hp: '', structure: -1, speed: 2.5, size: 4, tech_attack: -2 } })).toEqual(['stats.size', 'stats.structure', 'stats.hp', 'stats.speed'])
    expect(frameFields({ ...frame, stats: { ...stats, size: 0.5 } })).toEqual([])
    expect(frameFields({ ...frame, stats: {} })).toEqual(FRAME_STATS.filter((s) => !s.unused).map((s) => `stats.${s.key}`))
  })
  it('needs a manufacturer, a licence rank of 0 to 3 and at least one known mount', () => {
    expect(frameFields({ ...frame, source: '', license_level: 4 })).toEqual(['source', 'license_level'])
    expect(frameFields({ ...frame, mounts: [] })).toEqual(['mounts'])
    expect(frameFields({ ...frame, mounts: ['Main', 'Huge'] })).toEqual(['mounts.1'])
  })
  it("keeps bonuses the build maths doesn't count (the data has accuracy ones with no val) without erroring", () => {
    const core = { ...(frame.core_system as Data), active_bonuses: [{ id: 'check', accuracy: 1 }] }
    expect(found('frames', { ...frame, core_system: core }, frameCtx)).toEqual([])
    expect(problemsFor('frames', { ...frame, core_system: core }, frameCtx)).toEqual([expect.objectContaining({ level: 'warn' })])
  })
  it('warns when a frame is not its own licence', () => {
    expect(problemsFor('frames', { ...frame, license_id: 'other' }, frameCtx)).toEqual([expect.objectContaining({ level: 'warn', field: 'license_id' })])
  })
  it('wants named, different traits, and checks their actions, bonuses and deployables', () => {
    expect(frameFields({ ...frame, traits: [{ name: '' }, { name: 'Slow' }, { name: 'slow' }] })).toEqual(['traits.0.name', 'traits.2.name'])
    const broken = { ...frame, traits: [{ name: 'T', actions: [{ name: '' }], bonuses: [{ id: 'hp', val: 'lots' }], deployables: [{ name: '' }] }] }
    expect(frameFields(broken)).toEqual(['traits.0.bonuses.0.val', 'traits.0.actions.0.name', 'traits.0.deployables.0.name'])
  })
  it('needs a core system name, and checks its power, passive, built-in items and deployables', () => {
    const core = frame.core_system as Data
    expect(frameFields({ ...frame, core_system: { ...core, name: ' ' } })).toEqual(['core_system.name'])
    const broken = { ...frame, core_system: { ...core, integrated: ['nope'], active_actions: [{ name: '' }], passive_bonuses: [{ id: 'hp', val: 'x' }], deployables: [{ name: '' }] } }
    expect(frameFields(broken)).toEqual(['core_system.active_actions.0.name', 'core_system.passive_bonuses.0.val', 'core_system.integrated', 'core_system.deployables.0.name'])
  })
})
