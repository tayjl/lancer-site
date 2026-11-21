import { describe, expect, it, vi } from 'vitest'
import submitRulesSql from '../supabase/migrations/20261121140000_homebrew_rules.sql?raw'
import { equipmentDetails } from './equipment'
import { toItem, type Item } from './gameData'
import type { Frame } from './mechData'
import { adjustGrants, bracingMount, freeGear, GEAR_PRICE_DEFAULT, gearPrice, coreBonusPicks, gmOnly, isExotic, restrictionOf, restrictionReason, coreBonusProblems, isLicensed, mannaSpent, mechCount, mechProblems, nextMechPrice, personalPoints, personalStatProblems, pilotProblems, PRICES, STARTING_MANNA, superheavyMount, type Catalogue } from './rules'

// gameData and mechData also load the catalogues, which needs Supabase; these tests don't.
vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const frame = (id: string, licenceLevel: number, mounts: string[], sp = 5): Frame => ({
  id,
  name: id,
  source: 'IPS-N',
  licenceLevel,
  integrated: [],
  mechtype: [],
  mounts,
  stats: { structure: 4, stress: 4, armor: 1, hp: 10, evasion: 8, heatcap: 5, repcap: 4, sp },
  description: '',
})
const item = (id: string, fields: Record<string, unknown>): Item => toItem(id, { name: id, ...fields })

const everest = frame('everest', 0, ['Flex', 'Main', 'Heavy'])
const blackbeard = frame('blackbeard', 2, ['Flex', 'Main', 'Heavy'])
const weapons = [
  item('rifle', { mount: 'Main' }),
  item('pistol', { mount: 'Auxiliary' }),
  item('cannon', { mount: 'Superheavy' }),
  item('chain_axe', { mount: 'Main', license_id: 'blackbeard', license_level: 1 }),
]
const systems = [
  item('paint', { sp: 1, tags: [{ id: 'tg_unique' }] }),
  item('nhp_a', { sp: 2, tags: [{ id: 'tg_ai' }] }),
  item('nhp_b', { sp: 2, tags: [{ id: 'tg_ai' }] }),
  item('heat_sink', { sp: 4, license_id: 'blackbeard', license_level: 3 }),
]
const catalogue: Catalogue = {
  frames: [everest, blackbeard],
  weapons: new Map(weapons.map((w) => [w.id, w])),
  systems: new Map(systems.map((s) => [s.id, s])),
  integrated: new Map(),
  coreBonuses: [{ id: 'cb_a', name: 'GMS bonus', source: 'GMS', effect: '' }],
  bionicCosts: new Map([
    [1, 2],
    [2, 3],
  ]),
  bionicPrices: new Map([
    [1, 500],
    [2, 500],
  ]),
}

describe('personal stat allocation', () => {
  it('allows four extra points on top of base 2', () => {
    expect(personalPoints({ physicality: 4, dexterity: 3, perception: 3, acuity: 2, tech_fluency: 2 })).toBe(4)
    expect(personalStatProblems({ physicality: 4, dexterity: 3, perception: 3, acuity: 2, tech_fluency: 2 })).toEqual([])
    expect(personalStatProblems()).toEqual([])
  })

  it('rejects low, high and fractional bases and does not let a low value refund points', () => {
    const values = { physicality: 1, dexterity: 5, acuity: 2.5, perception: 4 }
    expect(personalPoints(values)).toBe(5.5)
    expect(personalStatProblems(values)).toHaveLength(4)
  })

  it('checks personal allocations independently of level, spending and biomods', () => {
    const sheet = { pilot_stats: { physicality: 4, dexterity: 4, acuity: 3 } }
    expect(pilotProblems(sheet, { level: 20, manna: 1000 }, catalogue, {}, null)).toEqual([
      'Personal stats use 5 points, but only 4 are available.',
    ])
  })
})

describe('licences', () => {
  it('lets anyone use free items, and licensed ones from the right rank', () => {
    expect(isLicensed({ licenceId: 'everest', licenceLevel: 0 }, undefined)).toBe(true)
    expect(isLicensed({ licenceId: 'blackbeard', licenceLevel: 2 }, { blackbeard: 1 })).toBe(false)
    expect(isLicensed({ licenceId: 'blackbeard', licenceLevel: 2 }, { blackbeard: 2 })).toBe(true)
  })

  it('flags a licensed frame, weapon or system without the rank', () => {
    const sheet = { licences: { blackbeard: 1 }, mech_skills: { systems: 4 } }
    const problems = mechProblems({ frame: 'blackbeard', mounts: [[null], ['chain_axe']], systems: ['heat_sink'] }, sheet, catalogue)
    expect(problems).toEqual([
      'The blackbeard frame needs IPS-N blackbeard licence rank II.',
      'heat_sink needs IPS-N blackbeard licence rank III.',
    ])
  })
})

describe('core bonus eligibility', () => {
  const frames = [everest, blackbeard, frame('drake', 2, []), { ...frame('sherman', 2, []), source: 'HA' }]
  const bonuses = [
    { id: 'gms', name: 'GMS bonus', source: 'GMS', effect: '' },
    { id: 'ips', name: 'IPS-N bonus', source: 'IPS-N', effect: '' },
    { id: 'ips2', name: 'Second IPS-N bonus', source: 'IPS-N', effect: '' },
    { id: 'ha', name: 'HA bonus', source: 'HA', effect: '' },
  ]
  const check = (licences: Record<string, number>, core_bonuses: string[]) => coreBonusProblems({ licences, core_bonuses }, frames, bonuses)

  it('counts ranks across licences from the same manufacturer', () => {
    expect(check({ blackbeard: 2, drake: 1 }, ['ips'])).toEqual([])
    expect(check({ blackbeard: 2, sherman: 1 }, ['ips'])).toEqual([
      'IPS-N core bonuses need 3 IPS-N licence ranks, but the pilot has 2.',
    ])
  })

  it('requires another three manufacturer ranks for a second bonus', () => {
    expect(check({ blackbeard: 3, sherman: 3 }, ['ips', 'ips2'])).toEqual([
      'IPS-N core bonuses need 6 IPS-N licence ranks, but the pilot has 3.',
    ])
    expect(check({ blackbeard: 3, drake: 3 }, ['ips', 'ips2'])).toEqual([])
    expect(check({ blackbeard: 3, sherman: 3 }, ['ips', 'ha'])).toEqual([])
  })

  it('exempts GMS from manufacturer requirements but still uses an overall slot', () => {
    expect(check({ blackbeard: 3, sherman: 3 }, ['ips', 'gms'])).toEqual([])
    expect(check({ blackbeard: 2 }, ['gms'])).toEqual([
      'Too many core bonuses: 1 taken, 0 available.',
    ])
  })

  it('rejects duplicates, missing content and invalid ranks as manufacturer credit', () => {
    expect(check({ blackbeard: 3, drake: 3 }, ['ips', 'ips'])).toContain('IPS-N bonus can only be taken once.')
    expect(check({ blackbeard: 3 }, ['missing'])).toContain("Core bonus missing isn't in any loaded pack.")
    const invalidLicences: Record<string, number>[] = [{ blackbeard: 6 }, { blackbeard: 2.5, drake: 1 }, { everest: 3 }, { missing: 3 }]
    for (const licences of invalidLicences)
      expect(check(licences, ['ips']).some((problem) => problem.includes('IPS-N licence ranks'))).toBe(true)
    expect(coreBonusProblems({ licences: { blackbeard: 3 }, core_bonuses: ['blank'] }, frames,
      [{ id: 'blank', name: 'Unspecified', source: '', effect: '' }])).toContain('Unspecified has no manufacturer.')
  })

  it('flags a saved bonus in the shared review check after its licences are reduced', () => {
    const sheet = { licences: { blackbeard: 2, sherman: 1 }, core_bonuses: ['ips'] }
    expect(pilotProblems(sheet, { level: 0, manna: 1800 }, { ...catalogue, frames, coreBonuses: bonuses }, {}, null)).toEqual([
      'IPS-N core bonuses need 3 IPS-N licence ranks, but the pilot has 2.',
    ])
  })
})

describe('mechs', () => {
  const sheet = { mech_skills: { systems: 0 } }

  it('uses bonus system points in the same capacity check as the displayed stats', () => {
    const mech = { frame: 'everest', systems: ['paint', 'heat_sink', 'nhp_a'] }
    const pilot = { licences: { blackbeard: 3 }, core_bonuses: ['capacity'] }
    const withBonus: Catalogue = { ...catalogue, coreBonuses: [{ id: 'capacity', name: 'Capacity', source: 'GMS', effect: '', bonuses: [{ id: 'sp', val: 2 }] }] }
    expect(mechProblems(mech, pilot, withBonus)).toEqual([])
    expect(mechProblems(mech, { ...pilot, core_bonuses: [] }, withBonus)).toEqual(['Uses 7 system points, but only 5 are available.'])
  })

  it('is happy with a legal GMS mech', () => {
    expect(mechProblems({ frame: 'everest', mounts: [['pistol', 'pistol'], ['rifle']], systems: ['paint'] }, sheet, catalogue)).toEqual([])
  })

  it('needs a second, empty mount for a superheavy weapon', () => {
    expect(superheavyMount([[null], ['rifle'], ['cannon']], (id) => catalogue.weapons.get(id)?.mount)).toBe(2)
    expect(bracingMount(everest.mounts, [[null], ['rifle'], ['cannon']], 2)).toBe(0)
    expect(bracingMount(everest.mounts, [['pistol'], ['rifle'], ['cannon']], 2)).toBe(-1)
    expect(bracingMount(['Heavy', 'Integrated Auxiliary'], [['cannon'], []], 0)).toBe(-1)
    expect(mechProblems({ frame: 'everest', mounts: [['pistol'], ['rifle'], ['cannon']] }, sheet, catalogue)).toEqual([
      'Superheavy weapon needs a second empty mount.',
    ])
  })

  it('braces a Superheavy mount on the Heavy mount, else any empty mount', () => {
    const frameMounts = ['Superheavy', 'Main', 'Heavy']
    expect(bracingMount(frameMounts, [['cannon'], [null], [null]], 0)).toBe(2)
    expect(bracingMount(frameMounts, [['cannon'], [null], ['rifle']], 0)).toBe(-1)
    expect(bracingMount(['Superheavy', 'Main'], [['cannon'], [null]], 0)).toBe(1)
    expect(bracingMount(['Superheavy', 'Integrated Auxiliary'], [['cannon'], []], 0)).toBe(-1)
    expect(mechProblems({ frame: 'sh', mounts: [['cannon'], ['rifle']] }, sheet, { ...catalogue, frames: [frame('sh', 0, ['Superheavy', 'Main'])] })).toEqual(['Superheavy weapon needs a second empty mount.'])
  })

  it('flags wrong mount sizes, duplicate uniques, two AIs and too many system points', () => {
    const problems = mechProblems(
      { frame: 'everest', mounts: [['rifle', 'pistol']], systems: ['paint', 'paint', 'nhp_a', 'nhp_b'] },
      sheet,
      catalogue,
    )
    expect(problems).toEqual([
      "pistol (auxiliary) doesn't fit its flex mount.",
      'paint is Unique. Only one allowed per mech.',
      'Only one AI allowed.',
      'Uses 6 system points, but only 5 are available.',
    ])
  })

  it('needs a damage type chosen for a Variable weapon', () => {
    const withGhoul: Catalogue = { ...catalogue, weapons: new Map([...catalogue.weapons, ['ghoul', item('ghoul', { mount: 'Main', damage: [{ type: 'Variable', val: 3 }] })]]) }
    const mech = { frame: 'everest', mounts: [[null], ['ghoul']] }
    expect(mechProblems(mech, sheet, withGhoul)).toEqual(['ghoul needs a damage type.'])
    expect(mechProblems({ ...mech, weapon_options: { '1:0': { damageType: 'Variable' } } }, sheet, withGhoul)).toEqual(['ghoul needs a damage type.'])
    expect(mechProblems({ ...mech, weapon_options: { '1:0': { damageType: 'Energy' } } }, sheet, withGhoul)).toEqual([])
    // The card shows the chosen type, or Variable until one is chosen.
    const ghoul = withGhoul.weapons.get('ghoul')!
    expect(equipmentDetails(ghoul, {}, [], { damageType: 'Energy' }).damage[0].type).toBe('Energy')
    expect(equipmentDetails(ghoul, {}, []).damage[0].type).toBe('Variable')
  })
})

describe('pilot weapons', () => {
  it('needs a damage type chosen for a Variable weapon, equipped or stowed', () => {
    const gear = [item('gun', { type: 'Weapon', damage: [{ type: 'Variable', val: 2 }] })]
    const run = (damageType?: string) => pilotProblems({ owned_gear: [{ key: 'k', id: 'gun', damageType }], equipped_gear: ['k'] }, { level: 0, manna: 10000 }, { ...catalogue, gear }, {}, null).filter(problem => problem.includes('damage type'))
    expect(run()).toEqual(['gun needs a damage type.'])
    expect(run('Energy')).toEqual([])
    const stowed = pilotProblems({ owned_gear: [{ key: 'k', id: 'gun' }], equipped_gear: [] }, { level: 0, manna: 10000 }, { ...catalogue, gear }, {}, null)
    expect(stowed).toContain('gun needs a damage type.')
  })
})

describe('homebrew levelling and manna', () => {
  it('flags invalid ranks and unavailable gear without granting negative spending refunds', () => {
    const sheet = { licences: { blackbeard: -3 }, talents: { missing: 1.5 }, mech_skills: { hull: -1 }, owned_gear: [{ key: 'k', id: 'missing' }], equipped_gear: ['k'] }
    const problems = pilotProblems(sheet, { level: 0, manna: 10000 }, { ...catalogue, gear: [] }, {}, null)
    expect(mannaSpent({ licences: { blackbeard: -3 } }, new Map(), 0, [], null)).toBe(0)
    expect(problems).toContain('blackbeard licence must be a whole rank from 0 to III.'.replace('blackbeard', 'IPS-N blackbeard'))
    expect(problems).toContain('Talent missing must be a whole rank from 0 to III.')
    expect(problems).toContain('Hull must be a whole number from 0 to 6.')
    expect(problems).toContain("Some pilot gear isn't in any loaded pack.")
  })
  it('prices licence ranks at 600, talent ranks at 300 and each biomod at its own price', () => {
    const prices = new Map([[1, 500], [2, 750]])
    expect(mannaSpent({ licences: { blackbeard: 2, drake: 1 }, bionics: [1, 2], talents: { t_ace: 1 } }, prices, 0, [], null)).toBe(3 * 600 + 500 + 750 + 300)
    expect(mannaSpent({ bionics: [1, 99] }, prices, 0, [], null)).toBe(500)
  })
  it('prices pilot gear at its manna_cost, or 100 when that is unset or not a whole number', () => {
    const cost = (manna_cost?: unknown) => gearPrice(item('g', manna_cost === undefined ? {} : { manna_cost }))
    expect([cost(), cost(250), cost(0), cost(-5), cost(2.5), cost('50')]).toEqual([100, 250, 0, 100, 100, 100])
  })
  it('charges for owned gear that is not free, and nothing for unknown items', () => {
    const gear = [item('vest', { type: 'Armor' }), item('knife', { type: 'Weapon', manna_cost: 250 })]
    const live = { owned_gear: [{ key: 'a', id: 'vest', free: true }] }
    const sheet = { owned_gear: [{ key: 'a', id: 'vest', free: true }, { key: 'b', id: 'knife' }, { key: 'c', id: 'knife', free: true }, { key: 'd', id: 'missing' }] }
    // Against the live sheet only the vest is free: "free" on the others is not trusted.
    expect(mannaSpent(sheet, new Map(), 0, gear, live)).toBe(500)
    // A never-approved pilot: the first armour and two weapons are free.
    expect(mannaSpent(sheet, new Map(), 0, gear, null)).toBe(0)
    expect(mannaSpent({ owned_gear: sheet.owned_gear.slice(0, 1) }, new Map(), 0, [], null)).toBe(0)
  })
  it('gives the first mech free and charges 500 for each one after it', () => {
    expect([0, 1, 2, 4].map((mechs) => mannaSpent({}, new Map(), mechs, [], null))).toEqual([0, 0, 500, 1500])
    expect(mannaSpent({ talents: { t_ace: 1 } }, new Map(), 3, [], null)).toBe(300 + 1000)
    expect([0, 1, 2].map(nextMechPrice)).toEqual([0, 500, 500])
    expect(mechCount([{}, {}])).toBe(2)
    expect(mechCount(null)).toBe(0)
  })
  it('counts the mechs in the manna check', () => {
    expect(pilotProblems({}, { level: 0, manna: 400 }, catalogue, { a: 'One', b: 'Two' }, null)).toEqual(['500 manna spent, but only 400 received.'])
    expect(pilotProblems({}, { level: 0, manna: 400 }, catalogue, { a: 'One' }, null)).toEqual([])
  })

  it('gives a core bonus for every 3 licence ranks', () => {
    expect([2, 3, 5, 6].map((ranks) => coreBonusPicks({ licences: { blackbeard: ranks } }))).toEqual([0, 1, 1, 2])
  })

  it('checks manna, HASE and biomods against level, core bonuses against licences, then each mech by name', () => {
    const sheet = {
      licences: { blackbeard: 2 },
      bionics: [1, 2],
      mech_skills: { hull: 3, agility: 1 },
      core_bonuses: ['cb_a'],
      mechs: { m1: { frame: 'everest', systems: ['nhp_a', 'nhp_b'] } },
    }
    expect(pilotProblems(sheet, { level: 1, manna: 2000 }, catalogue, { m1: 'Lantern' }, null)).toEqual([
      '2200 manna spent, but only 2000 received.',
      '4 HASE points taken, but level 1 only gives 3.',
      'Too many core bonuses: 1 taken, 0 available.',
      'Lantern: Only one AI allowed.',
    ])
    expect(pilotProblems({ bionics: [1, 2] }, { level: 0, manna: 1000 }, catalogue, {}, null)).toEqual([])
    expect(pilotProblems({ bionics: [1, 2, 2] }, { level: 0, manna: 1500 }, catalogue, {}, null)).toEqual([
      'Biomods use 8 mod points, but level 0 only gives 6.',
      'A biomod can only be installed once.',
    ])
    const dear = { ...catalogue, bionicPrices: new Map([[1, 750], [2, 500]]) }
    expect(pilotProblems({ bionics: [1, 2] }, { level: 0, manna: 1000 }, dear, {}, null)).toEqual(['1250 manna spent, but only 1000 received.'])
  })
})

describe('GM-only content', () => {
  const horus = frame('goblin', 2, ['Main'])
  horus.source = 'HORUS'
  const frames = [everest, blackbeard, horus]

  it('flags HORUS and NHC by source, ignoring case, and no longer Exotic', () => {
    expect(gmOnly(horus)).toBe(true)
    expect(gmOnly(item('a', { source: 'horus' }))).toBe(true) // an item's source is in its raw data
    expect(gmOnly(item('a', {}))).toBe(false)
    expect(gmOnly({ raw: { source: ' nhc ' } })).toBe(true)
    expect(gmOnly({ source: 'IPS-N' })).toBe(false)
    expect(gmOnly({ source: 'GMS' })).toBe(false)
    expect(gmOnly({ source: 'EXOTIC' })).toBe(false) // Exotic has its own rule (isExotic)
  })

  it('flags things whose licence is a frame from HORUS or NHC', () => {
    expect(gmOnly(item('visor', { license_id: 'goblin', license_level: 1 }), frames)).toBe(true)
    expect(gmOnly(item('rifle', { license_id: 'blackbeard', license_level: 1 }), frames)).toBe(false)
    expect(gmOnly(item('thing', { license_id: 'goblin' }))).toBe(false) // no frames given to look the licence up in
  })
})

describe('Exotic content', () => {
  it('is an item whose source is EXOTIC, ignoring case and spaces', () => {
    expect(isExotic({ source: 'EXOTIC' })).toBe(true)
    expect(isExotic({ source: ' exotic ' })).toBe(true)
    expect(isExotic(item('a', { source: 'Exotic' }))).toBe(true) // in the pack data
    expect(isExotic({ id: 7, source: 'EXOTIC' })).toBe(true) // a biomod
    expect(isExotic({ source: 'IPS-N' })).toBe(false)
    expect(isExotic({ source: null })).toBe(false)
    expect(isExotic({})).toBe(false)
  })

  it('is an item with the Exotic Gear tag, as objects or plain ids, on the item or in its data', () => {
    expect(isExotic(item('rifle', { mount: 'Main', tags: [{ id: 'tg_exotic' }] }))).toBe(true)
    expect(isExotic(item('sys', { sp: 1, tags: [{ id: 'tg_unique' }, { id: 'tg_exotic' }] }))).toBe(true)
    expect(isExotic({ tags: ['tg_exotic'] })).toBe(true)
    expect(isExotic({ tags: [{ id: 'TG_EXOTIC' }] })).toBe(true)
    expect(isExotic({ raw: { tags: [{ id: 'tg_exotic' }] } })).toBe(true)
    expect(isExotic({ source: 'NHC', tags: [{ id: 'tg_exotic' }] })).toBe(true) // a prototype with a real manufacturer
    expect(isExotic(item('plain', { tags: [{ id: 'tg_unique' }, { id: 'tg_limited', val: 2 }] }))).toBe(false)
    expect(isExotic(item('suit', { tags: [{ id: 'tg_exoskeleton' }] }))).toBe(false) // only the exact tag
  })

  it('ignores type, category, licence names and pack names', () => {
    expect(isExotic({ type: 'Exotic' })).toBe(false)
    expect(isExotic({ raw: { license: 'EXOTIC', category: 'exotic' } })).toBe(false)
    expect(isExotic({ licenceId: 'exotic' })).toBe(false)
  })
})

describe('what a picker refuses', () => {
  const horus = { gmOnly: true, exotic: false }
  const exotic = { gmOnly: false, exotic: true }
  const player = { gm: false, gmEdit: false }
  const gm = { gm: true, gmEdit: false }
  const gmEditing = { gm: true, gmEdit: true }

  it('blocks Exotic outside a GM edit mode, for players and for GMs on their own pilots', () => {
    expect(restrictionReason(exotic, player)).toBe('GM edit only')
    expect(restrictionReason(exotic, gm)).toBe('GM edit only')
    expect(restrictionReason(exotic, gmEditing)).toBe('')
  })

  it('keeps HORUS and NHC free for GMs and owners anywhere, blocked for players', () => {
    expect(restrictionReason(horus, player)).toBe('GM only')
    expect(restrictionReason(horus, gm)).toBe('')
    expect(restrictionReason(horus, gmEditing)).toBe('')
    expect(restrictionReason({ gmOnly: false, exotic: false }, player)).toBe('')
  })

  it('reads both from the thing itself', () => {
    expect(restrictionOf({ source: 'HORUS' })).toEqual({ gmOnly: true, exotic: false })
    expect(restrictionOf({ source: 'EXOTIC' })).toEqual({ gmOnly: false, exotic: true })
    expect(restrictionReason(restrictionOf({ source: 'NHC', tags: ['tg_exotic'] }), gm)).toBe('GM edit only')
  })
})

// The database refuses a submit that overspends manna (supabase/migrations/20261121140000_homebrew_rules.sql), so its
// prices must be the page's.
describe('free gear', () => {
  const types: Record<string, string> = { suit: 'Armor', vest: 'Armor', whip: 'Weapon', gun: 'Weapon', rifle: 'Weapon', kit: 'Gear', odd: 'Mod' }
  const typeOf = (id: string) => types[id]
  const owned = (...ids: string[]) => ids.map((id, n) => ({ key: `k${n}`, id }))
  it('on first approval frees the first 1 armour, 2 weapons and 3 gear in order', () => {
    expect(freeGear(owned('suit', 'vest', 'whip', 'gun', 'rifle', 'kit', 'kit', 'kit', 'kit'), typeOf, null))
      .toEqual([true, false, true, true, false, true, true, true, false])
    expect(freeGear(owned('missing', 'odd'), typeOf, null)).toEqual([false, false])
  })
  it('on a change frees only what the live sheet had free under the same key and id', () => {
    const live = { owned_gear: [{ key: 'k0', id: 'suit', free: true }, { key: 'k1', id: 'whip', free: false }, { key: 'k2', id: 'gun', free: true }] }
    expect(freeGear(owned('suit', 'whip', 'rifle', 'kit'), typeOf, live)).toEqual([true, false, false, false])
    // Same key, another item: not free.
    expect(freeGear([{ key: 'k0', id: 'vest' }, { key: 'k2', id: 'gun' }], typeOf, live)).toEqual([false, true])
  })
  it('frees a repeated key at most once, and an unknown id is never free', () => {
    const live = { owned_gear: [{ key: 'k0', id: 'suit', free: true }, { key: 'x', id: 'missing', free: true }] }
    expect(freeGear([{ key: 'k0', id: 'suit' }, { key: 'k0', id: 'suit' }], typeOf, live)).toEqual([true, false])
    expect(freeGear([{ key: 'x', id: 'missing' }], typeOf, null)).toEqual([false])
  })
})

describe('manna prices', () => {
  it('match the ones the submit check in the database uses', () => {
    const price = (name: string) => Number(new RegExp(`${name} constant integer := (\\d+);`).exec(submitRulesSql)?.[1])
    expect({ licenceRank: price('licence_rank_price'), talentRank: price('talent_rank_price'), extraMech: price('extra_mech_price') }).toEqual(PRICES)
    expect(price('starting_manna')).toBe(STARTING_MANNA)
    expect(price('default_gear_price')).toBe(GEAR_PRICE_DEFAULT)
  })
})

describe('GM grants', () => {
  const prices = new Map([[1, 500], [2, 750]])
  const gear = [item('knife', { type: 'Weapon', manna_cost: 250 })]
  const live = { owned_gear: [] }
  it('takes granted ranks, items and extra mechs off what was spent, never more than the sheet holds', () => {
    const sheet = { licences: { drake: 2 }, talents: { t_ace: 1 }, bionics: [1, 2], owned_gear: [{ key: 'a', id: 'knife' }, { key: 'b', id: 'knife' }] }
    const grants = { licences: { drake: 1 }, talents: { t_ace: 1 }, bionics: { 2: 1 }, gear: { knife: 1 }, mechs: 1 }
    expect(mannaSpent(sheet, prices, 3, gear, live, grants)).toBe(1850)
    // Granted more than held (the player removed some): only what is still held is free.
    expect(mannaSpent({ licences: { drake: 1 } }, prices, 1, [], null, { licences: { drake: 3 }, mechs: 2 })).toBe(0)
    expect(mannaSpent({}, prices, 0, [], null, { licences: { drake: 3 }, gear: { knife: 1 } })).toBe(0)
  })
  it('records what a GM adds and lowers the grant first on a removal, never below 0', () => {
    const added = adjustGrants({}, { licences: { drake: 1 }, bionics: [1] }, { licences: { drake: 3 }, bionics: [1, 2], owned_gear: [{ key: 'a', id: 'knife' }] }, 1, 2)
    expect(added).toEqual({ licences: { drake: 2 }, bionics: { 2: 1 }, gear: { knife: 1 }, mechs: 1 })
    const removed = adjustGrants(added, { licences: { drake: 3 }, bionics: [1, 2] }, { licences: { drake: 1 }, bionics: [1] }, 2, 1)
    expect(removed).toEqual({ gear: { knife: 1 } })
    expect(adjustGrants({}, { talents: { t_ace: 2 } }, {}, 3, 1)).toEqual({})
    expect(adjustGrants({ gear: { knife: 1 } }, {}, {}, 0, 0)).toEqual({ gear: { knife: 1 } })
  })
})
