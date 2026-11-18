import { describe, expect, it } from 'vitest'
import { blankItem, bonusTypesFor, errorsOf, newId, parseRaw, problemsFor, slug, usedBy, type Context } from './contentEditor'

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
  it('gives a personal stat its short key with no prefix', () => {
    expect(newId('pilot_stats', 'Tech-fluency', ['physicality'])).toBe('tech_fluency')
    expect(newId('pilot_stats', 'Acuity', ['acuity'])).toBe('acuity_2')
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
      'The ID can\'t change: it has to stay "hb_pg_vest", so pilots keep this item.',
      'A name is needed.',
      'Choose what kind of gear this is.',
    ])
  })
  it('needs a core bonus to have a manufacturer', () => {
    expect(texts({ id: 'hb_pg_vest', name: 'Bonus' }, 'core_bonuses')).toEqual(['Choose the manufacturer of this core bonus.'])
  })
  it('wants a number for a tag that takes one', () => {
    expect(texts({ ...vest, tags: [{ id: 'tg_limited' }] })).toEqual(['Limited needs a number.'])
    expect(texts({ ...vest, tags: [{ id: 'tg_limited', val: '3' }, { id: 'tg_unique' }] })).toEqual([])
    expect(texts({ ...vest, tags: [{ id: 'tg_heat_self', val: 'x' }] })).toEqual(['Heat (Self) needs a number.'])
  })
  it('warns, but allows, a tag that is not loaded', () => {
    expect(texts({ ...vest, tags: [{ id: 'tg_mystery' }] })).toEqual([])
    expect(texts({ ...vest, tags: [{ id: 'tg_mystery' }] }, 'pilot_gear', 'warn')).toEqual(['Tag "tg_mystery" isn\'t in the loaded tags.'])
    expect(texts({ ...vest, tags: [{}] })).toEqual(['Tag 1 needs choosing.'])
  })
  it('checks bonus numbers and formulas, and warns about bonuses the build maths ignores', () => {
    expect(texts({ ...vest, bonuses: [{ id: 'pilot_hp', val: 2 }, { id: 'physicality', val: '1' }, { id: 'sp', val: '{systems}/2' }] })).toEqual([])
    expect(texts({ ...vest, bonuses: [{ id: 'pilot_hp', val: 'lots' }, { val: 1 }] })).toEqual(['Bonus 1 needs a number, or a formula such as {systems}/2.', 'Bonus 2 needs a type.'])
    expect(texts({ ...vest, bonuses: [{ id: 'range', val: 1 }] }, 'pilot_gear', 'warn')).toEqual(['Bonus "range" isn\'t counted by the site\'s build maths.'])
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
    expect(texts({ ...vest, actions: [{ name: 'Dash', activation: 'Sometimes', detail: 'Dash.' }] }, 'pilot_gear', 'warn')).toEqual(["Action 1 has an activation the site doesn't know."])
    expect(texts({ ...vest, actions: [{ name: 'Dash', activation: 'Quick' }] }, 'pilot_gear', 'warn')).toEqual(["Action 1 has no rules text, so players won't see it."])
  })
  it('only lists errors as blocking', () => {
    expect(errorsOf(problemsFor('pilot_gear', { ...vest, tags: [{ id: 'tg_mystery' }] }, ctx))).toEqual([])
  })
})

describe('bionic and personal stat checks', () => {
  const bionic = { name: 'Arm', mod_point_cost: 2, bonuses: [{ stat_id: 'physicality', amount: 1 }] }
  it('accepts a bionic with a bonus on a stat that exists', () => {
    expect(texts(bionic, 'bionics')).toEqual([])
  })
  it('refuses a missing stat, a repeated stat, zero and fractions', () => {
    expect(texts({ ...bionic, bonuses: [{ stat_id: 'luck', amount: 1 }, { stat_id: 'acuity', amount: 0 }, { stat_id: 'acuity', amount: 1 }] }, 'bionics')).toEqual([
      'Bonus 1 needs a stat that exists.',
      'Bonus 2 needs a whole number other than 0.',
      'Only one bonus per stat: acuity is there twice.',
    ])
    expect(texts({ ...bionic, name: '', mod_point_cost: -1 }, 'bionics')).toEqual(['A name is needed.', 'Mod points need a whole number, 0 or more.'])
  })
  it('needs a personal stat to have a name and an order', () => {
    expect(texts({ name: 'Grit', sort_order: 6 }, 'pilot_stats')).toEqual([])
    expect(texts({ name: '', sort_order: 1.5 }, 'pilot_stats')).toEqual(['A name is needed.', 'The order needs a whole number.'])
  })
})

describe('bonus choices', () => {
  const stats = [{ id: 'physicality', name: 'Physicality' }]
  it('offers pilot gear only pilot bonuses and the personal stats', () => {
    expect(bonusTypesFor('pilot_gear', stats).map((type) => type.id)).toEqual(['pilot_hp', 'pilot_armor', 'pilot_speed', 'pilot_edef', 'physicality'])
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
    expect(blankItem('pilot_stats', 'grit', 6)).toEqual({ id: 'grit', name: '', sort_order: 6 })
    expect(blankItem('bionics', '')).toMatchObject({ mod_point_cost: 1, bonuses: [] })
  })
})
