import { describe, expect, it, vi } from 'vitest'
import { ICON_CHOICES, awardIcon } from './commendations'
import { errorsOf, validateCommendation } from './contentEditor'

vi.mock('./lib/supabaseClient', () => ({ supabase: {}, checkWrite: vi.fn(), fetchAll: vi.fn() }))

describe('commendation form', () => {
  const check = (name: string, description = '', icon = 'medal', others: string[] = []) => errorsOf(validateCommendation(name, description, icon, others, ICON_CHOICES))
  it('accepts a good one', () => expect(check('Steady hands', 'Kept calm')).toEqual([]))
  it('needs a name, unique whatever the capitals, and at most 60 characters', () => {
    expect(check('  ')[0].field).toBe('name')
    expect(check('steady HANDS', '', 'medal', ['Steady hands'])[0].text).toMatch(/already/)
    expect(check('x'.repeat(61))[0].field).toBe('name')
  })
  it('limits the description and needs an icon from the set', () => {
    expect(check('A', 'x'.repeat(301))[0].field).toBe('description')
    expect(check('A', '', 'not-an-icon')[0].field).toBe('icon')
  })
})

describe('awardIcon', () => {
  it('draws the stored icon, or a medal for one the set does not have', () => {
    expect(awardIcon('flame')).toBe('flame')
    expect(awardIcon('removed-icon')).toBe('medal')
  })
})
