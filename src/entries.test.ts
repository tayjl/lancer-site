import { describe, expect, it } from 'vitest'
import { parseEntries } from './entries'

describe('parseEntries', () => {
  it('keeps well-formed entries, in order', () => {
    const description = { type: 'doc', content: [] }
    expect(
      parseEntries([
        { id: 'a', name: 'steady hands', description },
        { id: 'b', name: 'reads people', description: null },
      ]),
    ).toEqual([
      { id: 'a', name: 'steady hands', description },
      { id: 'b', name: 'reads people', description: null },
    ])
  })

  it('drops entries without a usable id or name, and anything that is not an entry', () => {
    expect(
      parseEntries([
        { id: 'a', name: '' },
        { id: 'b', name: '   ' },
        { name: 'no id' },
        { id: 3, name: 'number id' },
        null,
        'a string',
        42,
        { id: 'ok', name: 'kept' },
      ]),
    ).toEqual([{ id: 'ok', name: 'kept', description: null }])
  })

  it('treats anything that is not a list as no entries (including older formatted-text traits)', () => {
    for (const value of [null, undefined, 'text', {}, { type: 'doc', content: [] }]) {
      expect(parseEntries(value)).toEqual([])
    }
  })

  it('does not copy unexpected extra fields', () => {
    expect(parseEntries([{ id: 'a', name: 'x', onclick: 'alert(1)' }])).toEqual([{ id: 'a', name: 'x', description: null }])
  })
})
