import { describe, expect, it, vi } from 'vitest'
import submitRulesSql from '../supabase/migrations/20261121090000_starting_manna_2000.sql?raw'
import { toItem, type Item } from './gameData'
import type { Frame } from './mechData'
import { bracingMount, coreBonusPicks, gmOnly, isExotic, restrictionOf, restrictionReason, coreBonusProblems, isLicensed, mannaSpent, mechCount, mechProblems, nextMechPrice, personalPoints, personalStatProblems, pilotProblems, PRICES, STARTING_MANNA, superheavyMount, type Catalogue } from './rules'

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
    expect(pilotProblems(sheet, { level: 20, manna: 1000 }, catalogue, {})).toEqual([
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
    expect(pilotProblems(sheet, { level: 0, manna: 1800 }, { ...catalogue, frames, coreBonuses: bonuses }, {})).toEqual([
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
})

describe('homebrew levelling and manna', () => {
  it('flags invalid ranks and unavailable gear without granting negative spending refunds', () => {
    const sheet = { licences: { blackbeard: -3 }, talents: { missing: 1.5 }, mech_skills: { hull: -1 }, pilot_gear: ['missing'] }
    const problems = pilotProblems(sheet, { level: 0, manna: 10000 }, { ...catalogue, gear: [] }, {})
    expect(mannaSpent({ licences: { blackbeard: -3 } }, new Map(), 0)).toBe(0)
    expect(problems).toContain('blackbeard licence must be a whole rank from 0 to III.'.replace('blackbeard', 'IPS-N blackbeard'))
    expect(problems).toContain('Talent missing must be a whole rank from 0 to III.')
    expect(problems).toContain('Hull must be a whole number from 0 to 6.')
    expect(problems).toContain("Some pilot gear isn't in any loaded pack.")
  })
  it('prices licence ranks at 600, talent ranks at 300 and each biomod at its own price', () => {
    const prices = new Map([[1, 500], [2, 750]])
    expect(mannaSpent({ licences: { blackbeard: 2, drake: 1 }, bionics: [1, 2], talents: { t_ace: 1 } }, prices, 0)).toBe(3 * 600 + 500 + 750 + 300)
    expect(mannaSpent({ bionics: [1, 99] }, prices, 0)).toBe(500)
  })
  it('gives the first mech free and charges 500 for each one after it', () => {
    expect([0, 1, 2, 4].map((mechs) => mannaSpent({}, new Map(), mechs))).toEqual([0, 0, 500, 1500])
    expect(mannaSpent({ talents: { t_ace: 1 } }, new Map(), 3)).toBe(300 + 1000)
    expect([0, 1, 2].map(nextMechPrice)).toEqual([0, 500, 500])
    expect(mechCount([{}, {}])).toBe(2)
    expect(mechCount(null)).toBe(0)
  })
  it('counts the mechs in the manna check', () => {
    expect(pilotProblems({}, { level: 0, manna: 400 }, catalogue, { a: 'One', b: 'Two' })).toEqual(['500 manna spent, but only 400 received.'])
    expect(pilotProblems({}, { level: 0, manna: 400 }, catalogue, { a: 'One' })).toEqual([])
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
    expect(pilotProblems(sheet, { level: 1, manna: 2000 }, catalogue, { m1: 'Lantern' })).toEqual([
      '2200 manna spent, but only 2000 received.',
      '4 HASE points taken, but level 1 only gives 3.',
      'Too many core bonuses: 1 taken, 0 available.',
      'Lantern: Only one AI allowed.',
    ])
    expect(pilotProblems({ bionics: [1, 2] }, { level: 0, manna: 1000 }, catalogue, {})).toEqual([])
    expect(pilotProblems({ bionics: [1, 2, 2] }, { level: 0, manna: 1500 }, catalogue, {})).toEqual([
      'Biomods use 8 mod points, but level 0 only gives 6.',
      'A biomod can only be installed once.',
    ])
    const dear = { ...catalogue, bionicPrices: new Map([[1, 750], [2, 500]]) }
    expect(pilotProblems({ bionics: [1, 2] }, { level: 0, manna: 1000 }, dear, {})).toEqual(['1250 manna spent, but only 1000 received.'])
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

// The database refuses a submit that overspends manna (supabase/migrations/20261121090000_starting_manna_2000.sql), so its
// prices must be the page's.
describe('manna prices', () => {
  it('match the ones the submit check in the database uses', () => {
    const price = (name: string) => Number(new RegExp(`${name} constant integer := (\\d+);`).exec(submitRulesSql)?.[1])
    expect({ licenceRank: price('licence_rank_price'), talentRank: price('talent_rank_price'), extraMech: price('extra_mech_price') }).toEqual(PRICES)
    expect(price('starting_manna')).toBe(STARTING_MANNA)
  })
})
