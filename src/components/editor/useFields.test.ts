import { describe, expect, it } from 'vitest'
import { useRowKeys } from './useFields'

describe('useRowKeys', () => {
  it('keeps a row’s key when another is removed or moved', () => {
    const rows = useRowKeys()
    const [a, b, c] = [0, 1, 2].map(rows.keyOf)
    rows.removed(0)
    expect([rows.keyOf(0), rows.keyOf(1)]).toEqual([b, c])
    rows.moved(0, 1)
    expect([rows.keyOf(0), rows.keyOf(1)]).toEqual([c, b])
    expect(rows.keyOf(2)).not.toBe(a)
  })
})
