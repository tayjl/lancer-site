import { describe, expect, it, vi } from 'vitest'
import { loadoutSlots } from './gameData'

// gameData also loads the catalogues, which needs Supabase; these tests don't.
vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const TYPES: Record<string, string> = { suit: 'Armor', vest: 'Armor', whip: 'Weapon', pistol: 'Weapon', rifle: 'Weapon', drone: 'Gear' }
const typeOf = (id: string) => TYPES[id]
const ids = (layout: ReturnType<typeof loadoutSlots>) => layout.slots.map((slot) => slot.id)

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
