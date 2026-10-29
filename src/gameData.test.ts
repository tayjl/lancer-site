import { describe, expect, it, vi } from 'vitest'
import { loadoutSlots, pilotVitals, sheetStats, toItem, type Bionic } from './gameData'

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
  const values = (chosen: string[]) => pilotVitals({ pilot_gear: chosen }, [suit, kit]).map(stat => stat.value)

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
    const result = sheetStats({}, stats, [])
    expect(result.personal.map(stat => stat.value)).toEqual([2, 2])
    expect(result.piloting.map(stat => stat.value)).toEqual([0, 0, 0, 0])
  })

  it('keeps positive and negative biomod bonuses separate from the allocated base', () => {
    const bionics = [{ id: 1, bonuses: [{ stat_id: 'physicality', amount: 2 }, { stat_id: 'acuity', amount: -1 }] }] as Bionic[]
    const result = sheetStats({ pilot_stats: { physicality: 4, acuity: 2 }, bionics: [1] }, stats, bionics)
    expect(result.personal.map(stat => [stat.value, stat.bonus, stat.value + stat.bonus])).toEqual([[4, 2, 6], [2, -1, 1]])
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
