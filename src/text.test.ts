import { describe, expect, it } from 'vitest'
import { capitalise, plural } from './text'

describe('text helpers', () => {
  it('pluralises in code', () => {
    expect(plural(1, 'pilot')).toBe('1 pilot')
    expect(plural(0, 'pilot')).toBe('0 pilots')
    expect(plural(2, 'entry', 'entries')).toBe('2 entries')
  })
  it('capitalises the first letter only', () => {
    expect(capitalise('hull is 4')).toBe('Hull is 4')
  })
})
