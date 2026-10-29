import { describe, expect, it, vi } from 'vitest'
import { toItem, type Item } from './gameData'
import type { Frame } from './mechData'
import { bracingMount, coreBonusPicks, isLicensed, mannaSpent, mechProblems, personalPoints, personalStatProblems, pilotProblems, superheavyMount, type Catalogue } from './rules'

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

describe('mechs', () => {
  const sheet = { mech_skills: { systems: 0 } }

  it('is happy with a legal GMS mech', () => {
    expect(mechProblems({ frame: 'everest', mounts: [['pistol', 'pistol'], ['rifle']], systems: ['paint'] }, sheet, catalogue)).toEqual([])
  })

  it('needs a second, empty mount for a superheavy weapon', () => {
    expect(superheavyMount([[null], ['rifle'], ['cannon']], (id) => catalogue.weapons.get(id)?.mount)).toBe(2)
    expect(bracingMount(everest.mounts, [[null], ['rifle'], ['cannon']], 2)).toBe(0)
    expect(bracingMount(everest.mounts, [['pistol'], ['rifle'], ['cannon']], 2)).toBe(-1)
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
    ])
  })
})
