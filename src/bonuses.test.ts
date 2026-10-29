import { describe, expect, it } from 'vitest'
import { bonusValue, resolveBonuses } from './bonuses'

describe('permanent bonus arithmetic', () => {
  it('calculates only supported arithmetic and explicit build variables', () => {
    expect(bonusValue('floor({ll}/2) + max(2, {hull})', { ll: 5, hull: 3 })).toBe(5)
    expect(bonusValue('-(2+3)*2 + ceil(1.5)')).toBe(-8)
    expect(bonusValue('2%2')).toBe(0)
    for (const value of ['globalThis.alert(1)', '1/0', '{exposed}', '{grit}', '1d6', '', 'min(1);2', 'floor(1,2)', null, true, Infinity, '('.repeat(300)]) expect(bonusValue(value)).toBeNull()
  })
  it('handles stat replacements and highest overrides in the documented order', () => {
    const entries = [{ source: 'addition', value: 4 }, { source: 'replacement', value: 3, replace: true }, { source: 'overwrite', value: 5, overwrite: true }]
    expect(resolveBonuses(10, entries).value).toBe(8)
    const fixed = resolveBonuses(10, [...entries, { source: 'fixed', value: 2, replace: true, overwrite: true }])
    expect(fixed.value).toBe(2)
    expect(fixed.used.map(entry => entry.source)).toEqual(['fixed'])
    expect(fixed.usesBase).toBe(false)
  })
})
