import { describe, expect, it, vi } from 'vitest'
import { toItem, type Item } from './gameData'
import type { Frame } from './mechData'
import { bracingMount, coreBonusPicks, coreBonusProblems, isLicensed, mannaSpent, mechProblems, personalPoints, personalStatProblems, pilotProblems, superheavyMount, type Catalogue } from './rules'

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
      '5 personal stat points allocated, but only 4 are available.',
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
      'the blackbeard frame needs IPS-N blackbeard licence rank II.',
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
      'IPS-N core bonuses need 3 IPS-N licence ranks; you have 2.',
    ])
  })

  it('requires another three manufacturer ranks for a second bonus', () => {
    expect(check({ blackbeard: 3, sherman: 3 }, ['ips', 'ips2'])).toEqual([
      'IPS-N core bonuses need 6 IPS-N licence ranks; you have 3.',
    ])
    expect(check({ blackbeard: 3, drake: 3 }, ['ips', 'ips2'])).toEqual([])
    expect(check({ blackbeard: 3, sherman: 3 }, ['ips', 'ha'])).toEqual([])
  })

  it('exempts GMS from manufacturer requirements but still uses an overall slot', () => {
    expect(check({ blackbeard: 3, sherman: 3 }, ['ips', 'gms'])).toEqual([])
    expect(check({ blackbeard: 2 }, ['gms'])).toEqual([
      'core bonuses taken: 1, but 2 licence ranks only give 0.',
    ])
  })

  it('rejects duplicates, missing content and invalid ranks as manufacturer credit', () => {
    expect(check({ blackbeard: 3, drake: 3 }, ['ips', 'ips'])).toContain('IPS-N bonus can only be taken once.')
    expect(check({ blackbeard: 3 }, ['missing'])).toContain("core bonus missing isn't in the loaded content packs.")
    const invalidLicences: Record<string, number>[] = [{ blackbeard: 6 }, { blackbeard: 2.5, drake: 1 }, { everest: 3 }, { missing: 3 }]
    for (const licences of invalidLicences)
      expect(check(licences, ['ips']).some((problem) => problem.includes('IPS-N licence ranks'))).toBe(true)
    expect(coreBonusProblems({ licences: { blackbeard: 3 }, core_bonuses: ['blank'] }, frames,
      [{ id: 'blank', name: 'Unspecified', source: '', effect: '' }])).toContain('Unspecified has no manufacturer in the loaded content packs.')
  })

  it('flags a saved bonus in the shared review check after its licences are reduced', () => {
    const sheet = { licences: { blackbeard: 2, sherman: 1 }, core_bonuses: ['ips'] }
    expect(pilotProblems(sheet, { level: 0, manna: 1800 }, { ...catalogue, frames, coreBonuses: bonuses }, {})).toEqual([
      'IPS-N core bonuses need 3 IPS-N licence ranks; you have 2.',
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
    expect(mechProblems(mech, { ...pilot, core_bonuses: [] }, withBonus)).toEqual(['its system points are over: 7/5.'])
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
      'its superheavy weapon needs a second, empty mount.',
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
      'paint is unique: one per mech.',
      'only one AI per mech.',
      'its system points are over: 6/5.',
    ])
  })
})

describe('homebrew levelling and manna', () => {
  it('flags invalid ranks and unavailable gear without granting negative spending refunds', () => {
    const sheet = { licences: { blackbeard: -3 }, talents: { missing: 1.5 }, mech_skills: { hull: -1 }, pilot_gear: ['missing'] }
    const problems = pilotProblems(sheet, { level: 0, manna: 10000 }, { ...catalogue, gear: [] }, {})
    expect(mannaSpent({ licences: { blackbeard: -3 } })).toBe(0)
    expect(problems).toContain('blackbeard licence must be a whole rank from 0 to III.'.replace('blackbeard', 'IPS-N blackbeard'))
    expect(problems).toContain('talent missing must be a whole rank from 0 to III.')
    expect(problems).toContain('hull must be a whole number from 0 to 6.')
    expect(problems).toContain('pilot gear includes items unavailable in the loaded content packs.')
  })
  it('prices licence ranks at 600, biomods at 500 and talent ranks at 300', () => {
    expect(mannaSpent({ licences: { blackbeard: 2, drake: 1 }, bionics: [1, 2], talents: { t_ace: 1 } })).toBe(3 * 600 + 2 * 500 + 300)
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
      '4 hase points taken, but level 1 only gives 3.',
      'core bonuses taken: 1, but 2 licence ranks only give 0.',
      'Lantern: only one AI per mech.',
    ])
    expect(pilotProblems({ bionics: [1, 2] }, { level: 0, manna: 1000 }, catalogue, {})).toEqual([])
    expect(pilotProblems({ bionics: [1, 2, 2] }, { level: 0, manna: 1500 }, catalogue, {})).toEqual([
      'bionics use 8 mod points, but level 0 only gives 6.',
      'a biomod can only be installed once.',
    ])
  })
})
