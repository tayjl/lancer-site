import { describe, expect, it, vi } from 'vitest'
import { allowedSizes, mechStats, mountSize, type Frame } from './mechData'

// mechData also loads the catalogues, which needs Supabase; these tests don't.
vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

describe('allowedSizes', () => {
  it('fits weapons to each mount by size', () => {
    expect(allowedSizes('Main', 0, [null])).toEqual(['Main', 'Auxiliary'])
    expect(allowedSizes('Heavy', 0, [null])).toEqual(['Superheavy', 'Heavy', 'Main', 'Auxiliary'])
    expect(allowedSizes('Aux/Aux', 1, [null, null])).toEqual(['Auxiliary'])
    expect(allowedSizes('Main/Aux', 1, ['Main', null])).toEqual(['Auxiliary'])
    expect([mountSize('Main'), mountSize('Flex'), mountSize('Aux/Aux')]).toEqual([1, 2, 2])
  })

  it('lets a Flex mount hold one Main weapon or two Auxiliary ones', () => {
    expect(allowedSizes('Flex', 0, [null, null])).toEqual(['Main', 'Auxiliary'])
    expect(allowedSizes('Flex', 1, ['Main', null])).toEqual([])
    expect(allowedSizes('Flex', 1, ['Auxiliary', null])).toEqual(['Auxiliary'])
    expect(allowedSizes('Flex', 0, [null, 'Auxiliary'])).toEqual(['Auxiliary'])
  })
})

describe('mechStats', () => {
  const blackbeard: Frame = {
    id: 'mf_blackbeard',
    name: 'Blackbeard',
    source: 'IPS-N',
    licenceLevel: 2,
    integrated: [],
    mechtype: ['Striker'],
    mounts: ['Flex', 'Main', 'Heavy'],
    stats: { structure: 4, stress: 4, armor: 1, hp: 12, evasion: 8, heatcap: 4, repcap: 5, sp: 5 },
    description: '',
  }
  const value = (stats: ReturnType<typeof mechStats>, id: string) => stats.find((stat) => stat.id === id)!.value

  it('adds the pilot\'s HASE to the frame, with no grit', () => {
    const stats = mechStats(blackbeard, { hull: 3, agility: 2, systems: 5, engineering: 1 })
    expect(value(stats, 'hp')).toBe(18)
    expect(value(stats, 'repair')).toBe(6)
    expect(value(stats, 'evasion')).toBe(10)
    expect(value(stats, 'heat')).toBe(5)
    expect(value(stats, 'system_points')).toBe(7)
    expect(value(stats, 'structure')).toBe(4)
  })

  it('counts unset skills as 0, and shows nothing without a frame', () => {
    expect(value(mechStats(blackbeard, undefined), 'hp')).toBe(12)
    expect(mechStats(null, undefined).every((stat) => stat.value === null)).toBe(true)
  })
})
