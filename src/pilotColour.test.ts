import { describe, expect, it } from 'vitest'
import { contrast, displayColour } from './pilotColour'

describe('displayColour', () => {
  it('leaves a colour that already shows alone (lower-cased)', () => {
    expect(displayColour('#FF6B6B')).toBe('#ff6b6b')
    expect(displayColour('#ffffff')).toBe('#ffffff')
  })
  it('lightens a colour that is too dark, to at least 3:1 against the panel', () => {
    for (const dark of ['#000000', '#101030', '#220000', '#1c1c21', '#003300']) {
      const shown = displayColour(dark)!
      expect(shown).not.toBe(dark)
      expect(contrast(shown, '#1c1c21')).toBeGreaterThanOrEqual(3)
    }
  })
  it('only lightens as far as it has to', () => {
    expect(contrast(displayColour('#000000')!, '#1c1c21')).toBeLessThan(3.6)
  })
  it('returns null for nothing or anything that is not #rrggbb', () => {
    for (const bad of [null, undefined, '', 'red', '#abc', '#12345g', 'javascript:1']) expect(displayColour(bad)).toBeNull()
  })
})
