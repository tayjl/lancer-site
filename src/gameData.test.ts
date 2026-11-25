import { describe, expect, it, vi } from 'vitest'
import { personalStatIds } from './bonuses'
import { bionicItems, loadoutSlots, pilotBonuses, pilotVitals, rankedSheet, sheetStats, talentRanks, toItem, type Bionic, type CoreBonus } from './gameData'
import { RULES_SEED, ruleItems } from './rulesData'

// gameData also loads the catalogues, which needs Supabase; these tests don't.
vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const TYPES: Record<string, string> = { suit: 'Armor', vest: 'Armor', whip: 'Weapon', pistol: 'Weapon', rifle: 'Weapon', drone: 'Gear' }
const typeOf = (id: string) => TYPES[id]
const ids = (layout: ReturnType<typeof loadoutSlots>) => layout.slots.map((slot) => slot.id)

describe('pilot vitals', () => {
  const suit = toItem('suit', { type: 'Armor', bonuses: [
    { id: 'pilot_hp', val: 3 }, { id: 'pilot_armor', val: 2 },
    { id: 'pilot_speed', val: 3, replace: true }, { id: 'pilot_evasion', val: 6, replace: true },
  ] })
  const kit = toItem('kit', { type: 'Gear', bonuses: [{ id: 'pilot_speed', val: 1 }] })
  const values = (chosen: string[]) => pilotVitals({ owned_gear: chosen.map((id, n) => ({ key: `k${n}`, id })), equipped_gear: chosen.map((_, n) => `k${n}`) }, [suit, kit]).map(stat => stat.value)

  it('uses unarmoured defaults, equipped bonuses and replacement speed', () => {
    expect(values([])).toEqual([6, 0, 4, 10])
    expect(values(['suit'])).toEqual([9, 2, 3, 10])
    expect(values(['kit', 'suit'])).toEqual([9, 2, 4, 10])
    expect(values(['suit', 'suit'])).toEqual([9, 2, 3, 10])
    expect(values(['missing'])).toEqual([null, null, null, null])
  })

  it('ignores pilot evasion bonuses while retaining mech evasion and pilot e-defence', () => {
    expect(suit.bonuses.map(bonus => bonus.id)).toEqual(['pilot_hp', 'pilot_armor', 'pilot_speed'])
    expect(toItem('test', { bonuses: [{ id: 'pilot_evasion', val: 2 }, { id: 'evasion', val: 2 }, { id: 'pilot_edef', val: 2 }] }).bonuses.map(bonus => bonus.id)).toEqual(['evasion', 'pilot_edef'])
  })
})

describe('personal stats', () => {
  const stats = [{ id: 'physicality', name: 'Physicality' }, { id: 'acuity', name: 'Acuity' }]

  it('starts each personal stat at 2 without changing the HASE defaults', () => {
    const result = sheetStats({}, stats)
    expect(result.personal.map(stat => stat.value)).toEqual([2, 2])
    expect(result.piloting.map(stat => stat.value)).toEqual([0, 0, 0, 0])
  })

  it('keeps positive and negative biomod bonuses separate from the allocated base', () => {
    const bionics = [{ id: 1, name: 'Arm', effect_bonuses: [{ id: 'physicality', val: 2 }, { id: 'acuity', val: -1 }] }] as Bionic[]
    const sheet = { pilot_stats: { physicality: 4, acuity: 2 }, bionics: [1] }
    const result = sheetStats(sheet, stats, pilotBonuses(sheet, [], [], [], bionics))
    expect(result.personal.map(stat => [stat.value, stat.bonus, stat.value + stat.bonus])).toEqual([[4, 2, 6], [2, -1, 1]])
  })

  it('lists where a changed personal stat comes from, and nothing for an unchanged one', () => {
    const bionics = [{ id: 1, name: 'Arm', effect_bonuses: [{ id: 'physicality', val: 2 }] }] as Bionic[]
    const sheet = { pilot_stats: { physicality: 4 }, bionics: [1] }
    const result = sheetStats(sheet, stats, [{ source: 'Kit', bonus: { id: 'physicality', val: -1 } }, ...pilotBonuses(sheet, [], [], [], bionics)])
    expect(result.personal.map(stat => stat.contributors)).toEqual([['Base: 4', 'Kit: -1', 'Arm: +2'], []])
  })
})

describe('free talent ranks', () => {
  const grant = (val: unknown, extra = {}) => ({ id: 'talent_rank', talent: 'brawler', val, ...extra })
  const kit = toItem('kit', { type: 'Gear', name: 'Kit', bonuses: [grant(1)] })
  const core = { id: 'core', name: 'Core', bonuses: [grant(1)] } as unknown as CoreBonus
  const arm = { id: 1, name: 'Arm', effect_bonuses: [grant(1)] } as unknown as Bionic
  const talent = { id: 'brawler', name: 'Brawler', terse: '', ranks: [1, 2, 3, 4].map(n => ({ name: `R${n}`, description: '', bonuses: [{ id: 'pilot_hp', val: n }] })) }
  const worn = { owned_gear: [{ key: 'k', id: 'kit' }], equipped_gear: ['k'] }
  const none = { gear: [kit], coreBonuses: [core], bionics: [arm] }

  it('counts each source kind and lists where it came from', () => {
    expect(talentRanks({ ...worn, talents: { brawler: 1 } }, { gear: [kit] })).toEqual({ total: { brawler: 2 }, free: { brawler: { ranks: 1, sources: ['Kit'] } } })
    expect(talentRanks({ core_bonuses: ['core'] }, { coreBonuses: [core] }).total).toEqual({ brawler: 1 })
    expect(talentRanks({ bionics: [1] }, { bionics: [arm] }).total).toEqual({ brawler: 1 })
  })
  it('gives nothing for unequipped gear, an untaken core bonus or an uninstalled biomod', () => {
    expect(talentRanks({ owned_gear: [{ key: 'k', id: 'kit' }], talents: { other: 2 } }, none)).toEqual({ total: { other: 2 }, free: {} })
  })
  it('gives nothing for gear that overflows its slot', () => {
    const suit = toItem('suit', { type: 'Armor', bonuses: [] })
    const sheet = { owned_gear: [{ key: 'a', id: 'suit' }, { key: 'b', id: 'suit' }, { key: 'k', id: 'kit' }], equipped_gear: ['a', 'b', 'k'] }
    expect(talentRanks(sheet, { gear: [suit, kit] }).total).toEqual({ brawler: 1 })
    const armourGrant = toItem('suit', { type: 'Armor', name: 'Suit', bonuses: [grant(1)] })
    expect(talentRanks(sheet, { gear: [armourGrant, kit] }).total).toEqual({ brawler: 2 })
  })
  it('ignores a condition, a text or fractional value, zero and a missing talent', () => {
    const odd = { id: 'core', name: 'Core', bonuses: [grant(1, { condition: '{exposed}' }), grant('1'), grant(1.5), grant(0), grant(-1), { id: 'talent_rank', val: 1 }] } as unknown as CoreBonus
    expect(talentRanks({ core_bonuses: ['core'] }, { coreBonuses: [odd] })).toEqual({ total: {}, free: {} })
  })
  it('adds up several sources and the bought rank', () => {
    const sheet = { ...worn, core_bonuses: ['core'], bionics: [1], talents: { brawler: 2 } }
    const result = talentRanks(sheet, none)
    expect(result.total).toEqual({ brawler: 5 })
    expect(result.free.brawler).toEqual({ ranks: 3, sources: ['Kit', 'Core', 'Arm'] })
  })
  it('drops bought ranks that are not whole numbers from 0 up', () => {
    expect(talentRanks({ talents: { a: -1, b: 1.5, c: 2 } as Record<string, number> }, {}).total).toEqual({ c: 2 })
  })
  it('rankedSheet swaps in the total, leaves the input alone and never adds twice', () => {
    const sheet = { bionics: [1], talents: { brawler: 1 } }
    const once = rankedSheet(sheet, { bionics: [arm] })
    expect(once.talents).toEqual({ brawler: 2 })
    expect(sheet.talents).toEqual({ brawler: 1 })
    expect(rankedSheet(once, { bionics: [arm] })).toBe(once)
    expect(rankedSheet(sheet, { bionics: [arm] }).talents).toEqual({ brawler: 2 })
  })
  it('pilotBonuses counts a free rank and stops at the highest talent rank', () => {
    const hp = (sheet: Parameters<typeof pilotBonuses>[0]) => pilotBonuses(sheet, [], [talent], [], [arm]).filter(entry => entry.bonus.id === 'pilot_hp').map(entry => entry.bonus.val)
    expect(hp({ bionics: [1] })).toEqual([1])
    expect(hp({ bionics: [1], talents: { brawler: 1 } })).toEqual([1, 2])
    expect(hp({ bionics: [1], talents: { brawler: 3 } })).toEqual([1, 2, 3])
  })
  it('pilotBonuses honours a raised highest rank', () => {
    ruleItems.value = [{ id: 'rule_num_max_talent_rank', name: 'x', section: 'numbers', text: '', order: 1, numbers: [4] }]
    expect(pilotBonuses({ bionics: [1], talents: { brawler: 3 } }, [], [talent], [], [arm]).filter(entry => entry.bonus.id === 'pilot_hp')).toHaveLength(4)
    ruleItems.value = RULES_SEED
  })
})

describe('bionicItems', () => {
  it('shows the personal stat effects as facts and stat tiles, not other effects', () => {
    personalStatIds.value = new Set(['physicality'])
    const [item] = bionicItems([{ id: 1, name: 'Arm', source: 'IPS-N', slot: 'Arm', effect_bonuses: [{ id: 'physicality', val: 2 }, { id: 'hp', val: 5 }] }] as Bionic[])
    expect(item.facts).toEqual(['IPS-N', 'Arm', '+2 physicality'])
    expect(item.stats).toMatchObject([{ label: 'physicality', value: '+2' }])
  })
})

describe('loadoutSlots', () => {
  it('sorts items into 1 armour, 2 weapon and 3 gear slots, in the order they were added', () => {
    expect(ids(loadoutSlots(['drone', 'whip', 'suit', 'pistol'], typeOf))).toEqual(['suit', 'whip', 'pistol', 'drone', null, null])
  })

  it('allows the same item twice', () => {
    expect(ids(loadoutSlots(['drone', 'drone'], typeOf))).toEqual([null, null, null, 'drone', 'drone', null])
  })

  it('keeps items of unknown type aside, and lists extras that have no slot', () => {
    const layout = loadoutSlots(['suit', 'vest', 'gone', 'whip', 'pistol', 'rifle'], typeOf)
    expect(ids(layout)).toEqual(['suit', 'whip', 'pistol', null, null, null])
    expect(layout.unknown).toEqual(['gone'])
    expect(layout.overflow).toEqual(['vest', 'rifle'])
  })
})
