import { describe, expect, it } from 'vitest'
import { flatDamage, flatDamageText } from './damage'
import { itemDetails } from './itemDetails'
import { toItem } from './gameData'
import { vi } from 'vitest'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

describe('flat damage', () => {
  it('rounds the whole expression up, after adding dice and modifiers', () => {
    for (const [input, expected] of [['1d6', 4], ['2d6+1', 8], ['1d6+1d6', 7], ['D3', 2], [' 2d6 - 2 ', 5], [3, 3]] as const)
      expect(flatDamage(input)).toBe(expected)
  })

  it('preserves variable or unsupported expressions instead of making up damage', () => {
    for (const expression of ['1d6+X', '1d0', '1d6*2', 'special']) expect(flatDamage(expression)).toBe(expression)
  })

  it('converts damage prose without changing checks, movement or healing', () => {
    expect(flatDamageText('Roll 1d20, move 1d6 spaces, heal 1d6 HP and deal 1d6+2 AP kinetic damage.'))
      .toBe('Roll 1d20, move 1d6 spaces, heal 1d6 HP and deal 6 AP kinetic damage.')
    expect(flatDamageText('Deal <b>1d6</b> energy damage and +2d6 bonus damage.')).toBe('Deal <b>4</b> energy damage and +7 bonus damage.')
  })

  it('uses flat damage in shared card and picker details, keeping range unchanged', () => {
    const details = itemDetails(toItem('weapon', { damage: [{ type: 'Kinetic', val: '1d6' }], range: [{ type: 'Range', val: 10 }] }), new Map())
    expect(details.stats.map(stat => stat.value)).toEqual(['10', '4'])
    expect(details.stats[1]!.label).toBe('kinetic')
  })
})
