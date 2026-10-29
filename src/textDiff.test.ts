import { describe, expect, it } from 'vitest'
import { documentText, sameContent, textDiff } from './textDiff'

describe('review text comparison', () => {
  it.each([
    ['', 'new pilot'],
    ['old pilot', ''],
    ['a quiet pilot', 'a bold pilot'],
    ['one two one', 'one one two'],
    ['first\nsecond', 'first\nnew second'],
    ['the same text', 'the same text'],
  ])('preserves both versions: %s → %s', (before, after) => {
    const parts = textDiff(before, after)
    expect(parts.filter(part => part.kind !== 'added').map(part => part.text).join('')).toBe(before)
    expect(parts.filter(part => part.kind !== 'removed').map(part => part.text).join('')).toBe(after)
  })

  it('highlights separate edits without marking the unchanged words between them', () => {
    const parts = textDiff('a quiet pilot with blue eyes', 'a bold pilot with green eyes')
    expect(parts.filter(part => part.kind === 'added').map(part => part.text)).toEqual(['bold', 'green'])
    expect(parts.some(part => part.kind === 'same' && part.text.includes('pilot with'))).toBe(true)
  })

  it('bounds work on long replacements while retaining all text', () => {
    const before = 'old '.repeat(1000)
    const after = 'new '.repeat(1000)
    const parts = textDiff(before, after)
    expect(parts.filter(part => part.kind !== 'added').map(part => part.text).join('')).toBe(before)
    expect(parts.filter(part => part.kind !== 'removed').map(part => part.text).join('')).toBe(after)
  })

  it('reads safe document text and paragraph breaks without interpreting markup', () => {
    expect(documentText({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '<img onerror=attack()>' }] },
      { type: 'script', content: [{ type: 'text', text: 'attack()' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
    ] })).toBe('<img onerror=attack()>\nsecond')
  })

  it('ignores object key order but detects formatting and list-order changes', () => {
    expect(sameContent({ hull: 2, systems: 1 }, { systems: 1, hull: 2 })).toBe(true)
    expect(sameContent({ marks: ['bold'] }, { marks: [] })).toBe(false)
    expect(sameContent(['first', 'second'], ['second', 'first'])).toBe(false)
  })
})
