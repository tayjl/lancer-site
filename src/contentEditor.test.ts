import { describe, expect, it } from 'vitest'
import { blankItem, bonusTypesFor, errorsOf, lockedTags, newId, parseRaw, problemsFor, slug, usedBy, validateFaction, withExoticTag, type Context } from './contentEditor'

const ctx: Context = {
  id: 'hb_pg_vest',
  tags: new Map([['tg_limited', 'Limited {VAL}'], ['tg_heat_self', 'Heat (Self) {VAL}'], ['tg_unique', 'Unique']]),
  statIds: ['physicality', 'acuity'],
}
const texts = (data: Record<string, unknown>, kind: Parameters<typeof problemsFor>[0] = 'pilot_gear', level: 'error' | 'warn' = 'error') =>
  problemsFor(kind, data, ctx).filter((p) => p.level === level).map((p) => p.text)
const vest = { id: 'hb_pg_vest', name: 'Vest', type: 'Armor' }

describe('new ids', () => {
  it('makes a readable slug', () => {
    expect(slug('  Cinder Lance (Mk II)! ')).toBe('cinder_lance_mk_ii')
    expect(slug('Étoile')).toBe('etoile')
    expect(slug('???')).toBe('')
  })
  it('starts with the kind, and never reuses an id', () => {
    expect(newId('weapons', 'Cinder Lance', [])).toBe('hb_mw_cinder_lance')
    expect(newId('weapons', 'Cinder Lance', ['hb_mw_cinder_lance'])).toBe('hb_mw_cinder_lance_2')
    expect(newId('weapons', 'Cinder Lance', ['hb_mw_cinder_lance', 'hb_mw_cinder_lance_2'])).toBe('hb_mw_cinder_lance_3')
    expect(newId('pilot_gear', '', [])).toBe('hb_pg_new')
  })
})

describe('raw data', () => {
  it('reads one JSON object', () => {
    expect(parseRaw('{"id": "a"}')).toEqual({ value: { id: 'a' } })
  })
  it.each(['', '{', '[1]', '"text"', 'null'])('refuses %j with a plain message', (text) => {
    expect(parseRaw(text)).toHaveProperty('error')
  })
})

describe('item checks', () => {
  it('accepts a complete piece of gear', () => {
    expect(problemsFor('pilot_gear', vest, ctx)).toEqual([])
  })
  it('needs a name, a gear type and an id that stays the same', () => {
    expect(texts({ id: 'other', name: ' ', type: 'Hat' })).toEqual([
      'The ID must stay "hb_pg_vest".',
      'A name is needed.',
      'Choose a gear type.',
    ])
  })
  it('takes an unset manna cost, or a whole number from 0', () => {
    expect(texts({ ...vest, manna_cost: 0 })).toEqual([])
    expect(texts({ ...vest, manna_cost: 2.5 })).toEqual(['Manna cost must be a whole number, 0 or more.'])
    expect(texts({ ...vest, manna_cost: -1 })).toHaveLength(1)
    expect(texts({ ...vest, manna_cost: '' })).toHaveLength(1)
  })
  it('needs a core bonus to have a manufacturer', () => {
    expect(texts({ id: 'hb_pg_vest', name: 'Bonus' }, 'core_bonuses')).toEqual(['Choose a manufacturer.'])
  })
  it('wants a number for a tag that takes one', () => {
    expect(texts({ ...vest, tags: [{ id: 'tg_limited' }] })).toEqual(['Limited needs a number.'])
    expect(texts({ ...vest, tags: [{ id: 'tg_limited', val: '3' }, { id: 'tg_unique' }] })).toEqual([])
    expect(texts({ ...vest, tags: [{ id: 'tg_heat_self', val: 'x' }] })).toEqual(['Heat (Self) needs a number.'])
  })
  it('warns, but allows, a tag that is not loaded', () => {
    expect(texts({ ...vest, tags: [{ id: 'tg_mystery' }] })).toEqual([])
    expect(texts({ ...vest, tags: [{ id: 'tg_mystery' }] }, 'pilot_gear', 'warn')).toEqual(['Tag "tg_mystery" doesn\'t exist.'])
    expect(texts({ ...vest, tags: [{}] })).toEqual(['Tag 1 needs choosing.'])
  })
  it('checks bonus numbers and formulas, and warns about bonuses the build maths ignores', () => {
    expect(texts({ ...vest, bonuses: [{ id: 'pilot_hp', val: 2 }, { id: 'physicality', val: '1' }, { id: 'sp', val: '{systems}/2' }] })).toEqual([])
    expect(texts({ ...vest, bonuses: [{ id: 'pilot_hp', val: 'lots' }, { val: 1 }] })).toEqual(['Effect 1 needs a number, or a formula such as {systems}/2.', 'Effect 2 needs a type.'])
    expect(texts({ ...vest, bonuses: [{ id: 'mystery', val: 1 }] }, 'pilot_gear', 'warn')).toEqual(['Effect "mystery" isn\'t counted in the stats.'])
  })
  it('accepts dice for damage and shows a missing number', () => {
    expect(texts({ ...vest, damage: [{ type: 'Kinetic', val: '2d6+1' }, { type: 'Energy', val: 3 }] })).toEqual([])
    expect(texts({ ...vest, damage: [{ type: 'Kinetic', val: 'lots' }, { type: 'Sound', val: 1 }] })).toEqual([
      'Damage 1 needs a number or dice such as 1d6+2.',
      'Damage 2 needs a type.',
    ])
  })
  it('checks ranges and actions', () => {
    expect(texts({ ...vest, range: [{ type: 'Range', val: 5 }, { type: 'Mile', val: 'far' }] })).toEqual(['Range 2 needs a type.', 'Range 2 needs a number.'])
    expect(texts({ ...vest, actions: [{ name: 'Dash', activation: 'Quick' }, { name: '', activation: 'Quick' }] })).toEqual(['Action 2 needs a name.'])
    expect(texts({ ...vest, actions: [{ name: 'Dash', activation: 'Sometimes', detail: 'Dash.' }] }, 'pilot_gear', 'warn')).toEqual(["Action 1 has an unknown activation."])
    expect(texts({ ...vest, actions: [{ name: 'Dash', activation: 'Quick' }] }, 'pilot_gear', 'warn')).toEqual(["Action 1 has no rules text and won't show."])
  })
  it('only lists errors as blocking', () => {
    expect(errorsOf(problemsFor('pilot_gear', { ...vest, tags: [{ id: 'tg_mystery' }] }, ctx))).toEqual([])
  })
})

describe('bionic and personal stat checks', () => {
  const bionic = { name: 'Arm', slot: 'Arm', source: 'IPS-N', manna_cost: 750, mod_point_cost: 2, bonuses: [{ stat_id: 'physicality', amount: 1 }] }
  it('accepts a bionic with a bonus on a stat that exists', () => {
    expect(texts(bionic, 'bionics')).toEqual([])
  })
  it('refuses a missing stat, a repeated stat, zero and fractions', () => {
    expect(texts({ ...bionic, bonuses: [{ stat_id: 'luck', amount: 1 }, { stat_id: 'acuity', amount: 0 }, { stat_id: 'acuity', amount: 1 }] }, 'bionics')).toEqual([
      'Bonus 1 needs a stat that exists.',
      'Bonus 2 must be a whole number, not 0.',
      'Only one bonus per stat: acuity is there twice.',
    ])
    expect(texts({ ...bionic, name: '', mod_point_cost: -1 }, 'bionics')).toEqual(['A name is needed.', 'Mod points must be a whole number, 0 or more.'])
  })
  it('needs a whole price of 0 or more, and only warns about a missing slot', () => {
    expect(texts({ ...bionic, manna_cost: 12.5 }, 'bionics')).toEqual(['Price must be a whole number, 0 or more.'])
    expect(texts({ ...bionic, manna_cost: -1 }, 'bionics')).toHaveLength(1)
    expect(texts({ ...bionic, manna_cost: 0 }, 'bionics')).toEqual([])
    expect(texts({ ...bionic, slot: ' ' }, 'bionics')).toEqual([])
    expect(texts({ ...bionic, slot: ' ' }, 'bionics', 'warn')).toHaveLength(1)
  })
  it('only warns about a missing manufacturer', () => {
    expect(texts({ ...bionic, source: '' }, 'bionics')).toEqual([])
    expect(texts({ ...bionic, source: '' }, 'bionics', 'warn')).toEqual(["No manufacturer. It's listed under Other."])
  })
})

describe('bonus choices', () => {
  const stats = [{ id: 'physicality', name: 'Physicality' }]
  it('offers pilot gear every bonus and the personal stats', () => {
    expect(bonusTypesFor('pilot_gear', stats).map((type) => type.id)).toEqual(expect.arrayContaining(['pilot_hp', 'mod_points', 'hp', 'physicality']))
  })
  it('offers a core bonus the mech stats as well', () => {
    const ids = bonusTypesFor('core_bonuses', stats).map((type) => type.id)
    expect(ids).toContain('limited_bonus')
    expect(ids).toContain('physicality')
  })
})

describe('used by', () => {
  it('names up to three pilots', () => {
    expect(usedBy([])).toBe('')
    expect(usedBy(['WARDEN'])).toBe('Used by WARDEN')
    expect(usedBy(['A', 'B', 'C'])).toBe('Used by A, B, C')
    expect(usedBy(['A', 'B', 'C', 'D', 'E'])).toBe('Used by A, B, C and 2 more')
  })
})

describe('new items', () => {
  it('start with an id and a name, so the raw box always has something valid to edit', () => {
    expect(blankItem('frames', 'hb_mf_new')).toMatchObject({ id: 'hb_mf_new', license_id: 'hb_mf_new', name: '', mounts: ['Main'] })
    expect(blankItem('pilot_gear', 'hb_pg_new')).toMatchObject({ id: 'hb_pg_new', type: 'Gear' })
    expect(blankItem('bionics', '')).toMatchObject({ slot: '', source: '', effect: '', manna_cost: 500, mod_point_cost: 1, bonuses: [] })
  })
})

describe('the Exotic Gear tag', () => {
  it('is added to anything whose manufacturer is Exotic, once, and keeps the other tags', () => {
    const rifle = { id: 'hb_mw_x', name: 'X', source: 'EXOTIC', tags: [{ id: 'tg_unique' }] }
    expect(withExoticTag('weapons', rifle).tags).toEqual([{ id: 'tg_unique' }, { id: 'tg_exotic' }])
    expect(withExoticTag('weapons', withExoticTag('weapons', rifle))).toEqual(withExoticTag('weapons', rifle))
    expect(withExoticTag('pilot_gear', { id: 'g', name: 'G', source: ' exotic ' }).tags).toEqual([{ id: 'tg_exotic' }])
    for (const kind of ['systems', 'mods', 'frames', 'core_bonuses'] as const) expect(withExoticTag(kind, { source: 'EXOTIC' }).tags).toEqual([{ id: 'tg_exotic' }])
  })
  it('leaves other manufacturers, other kinds and biomods alone', () => {
    const gms = { id: 'a', name: 'A', source: 'GMS' }
    expect(withExoticTag('weapons', gms)).toBe(gms)
    const tagged = { id: 'a', name: 'A', source: 'NHC', tags: [{ id: 'tg_exotic' }] } // a prototype keeps its manufacturer
    expect(withExoticTag('weapons', tagged)).toBe(tagged)
    expect(withExoticTag('bionics', { source: 'EXOTIC' })).toEqual({ source: 'EXOTIC' })
    expect(withExoticTag('talents', { source: 'EXOTIC' })).toEqual({ source: 'EXOTIC' })
  })
  it('locks the tag in the form only while the manufacturer is Exotic', () => {
    expect(lockedTags({ source: 'EXOTIC' })).toEqual(['tg_exotic'])
    expect(lockedTags({ source: 'GMS' })).toEqual([])
    expect(lockedTags({})).toEqual([])
  })
})

describe('problemsFor site rows', () => {
  const ctx = { id: '', tags: new Map(), statIds: [], others: ['Union'] } as Context
  it('checks a faction and a commendation by their own rules', () => {
    expect(problemsFor('factions', { id: '', name: 'union ' }, ctx).map((p) => p.field)).toEqual(['name'])
    expect(problemsFor('commendations', { id: '', name: 'Ace', description: '', icon: 'medal' }, ctx)).toEqual([])
    expect(problemsFor('commendations', { id: '', name: 'Ace', description: '', icon: 'nope' }, ctx).map((p) => p.field)).toEqual(['icon'])
  })
})

describe('validateFaction', () => {
  it('needs a name no other faction has, whatever the capitals', () => {
    expect(validateFaction('Harrison Armory', ['Union'])).toEqual([])
    expect(validateFaction('  ', []).map((p) => p.field)).toEqual(['name'])
    expect(validateFaction('union ', ['Union']).map((p) => p.text)).toEqual(['Another faction already has that name.'])
  })
})

describe('effect bonuses and core bonus equipment', () => {
  const core = { id: 'hb_pg_vest', name: 'Core', source: 'GMS', effect: '' }
  const bonuses = (...list: Record<string, unknown>[]) => texts({ ...core, bonuses: list }, 'core_bonuses')
  it('accepts each effect bonus with its own kind of value', () => {
    expect(bonuses(
      { id: 'add_mount', val: 'Superheavy', max: 3 }, { id: 'add_mount', val: 'Integrated Auxiliary' }, { id: 'superheavy_mounting' },
      { id: 'cheap_struct', val: 1 }, { id: 'drone_hp', val: 5 }, { id: 'deployable_hp', val: 2 },
      { id: 'range', val: 1, weapon_types: ['Rifle'], range_types: ['Range'] }, { id: 'threat', val: 1 },
      { id: 'overcharge', val: ['1', '1d3', '1d6', '1d6+4'] },
    )).toEqual([])
  })
  it('rejects values that do not fit', () => {
    expect(bonuses({ id: 'add_mount', val: 'Huge' }, { id: 'add_mount', val: 'Main', max: 0 }, { id: 'drone_hp', val: 'lots' }, { id: 'overcharge', val: ['1', '2'] }, { id: 'range', val: 1, weapon_types: ['Wand'] })).toEqual([
      'Effect 1 needs a mount type.', 'Effect 2 needs a whole number of mounts, 1 or more.', 'Effect 3 needs a number.',
      'Effect 4 needs four overcharge steps, such as 1, 1d3, 1d6, 1d6+4.', 'Effect 5 has an unknown weapon type.',
    ])
  })
  it('checks built-in and optional items and the replace flag', () => {
    const known = { ...ctx, known: new Set(['mw_gl']) }
    const ids = (data: Record<string, unknown>) => problemsFor('core_bonuses', { ...core, ...data }, known).map((p) => p.text)
    expect(ids({ integrated: ['mw_gl'], special_equipment: ['mw_gl'], replace_integrated: true })).toEqual([])
    expect(ids({ integrated: ['nope'], special_equipment: ['nada'], replace_integrated: 'yes' })).toEqual([
      'Item "nope" doesn\'t exist.', 'Item "nada" doesn\'t exist.', 'Replace integrated must be yes or no.',
    ])
  })
})

describe('the "not counted" warning', () => {
  const warns = (...list: Record<string, unknown>[]) => texts({ id: 'hb_pg_vest', name: 'X', source: 'GMS', effect: '', bonuses: list }, 'core_bonuses', 'warn')
  it('stays quiet for every bonus the code applies', () => {
    expect(warns({ id: 'cheap_struct', val: 1 }, { id: 'add_mount', val: 'Main' }, { id: 'superheavy_mounting' }, { id: 'damage', val: 1 },
      { id: 'attack', accuracy: 1 }, { id: 'engineering', accuracy: -1 }, { id: 'pilot_hp', val: 2 }, { id: 'physicality', val: 1 })).toEqual([])
  })
  it('still warns for an id nothing reads', () => {
    expect(warns({ id: 'mystery', val: 1 })).toEqual(['Effect "mystery" isn\'t counted in the stats.'])
  })
})
