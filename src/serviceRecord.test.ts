import { describe, expect, it, vi } from 'vitest'
import { SHOWN, entryProblem, shownEntries, sortTimeline, today, type TimelineEntry } from './serviceRecord'

vi.mock('./lib/supabaseClient', () => ({ supabase: {}, checkWrite: vi.fn(), fetchAll: vi.fn() }))

const entry = (id: string, occurred_on: string, created_at: string): TimelineEntry =>
  ({ id, character_id: 1, kind: 'player', title: id, body: null, occurred_on, created_at, updated_at: created_at })

describe('service record', () => {
  it('sorts newest first by date, then by when it was written', () => {
    const list = [entry('a', '2026-01-01', '2026-01-01T10:00:00Z'), entry('b', '2026-03-01', '2026-03-01T09:00:00Z'), entry('c', '2026-03-01', '2026-03-01T12:00:00Z')]
    expect(sortTimeline(list).map((e) => e.id)).toEqual(['c', 'b', 'a'])
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']) // the input is left alone
  })
  it('shows the first ten, or all', () => {
    const list = sortTimeline(Array.from({ length: 14 }, (_, i) => entry(`e${String(i).padStart(2, '0')}`, `2026-01-${String(i + 1).padStart(2, '0')}`, '2026-01-01T00:00:00Z')))
    expect(shownEntries(list, false)).toHaveLength(SHOWN)
    expect(shownEntries(list, true)).toHaveLength(14)
    expect(shownEntries(list, false)[0].id).toBe('e13')
  })
  it('checks a form: a title and a date', () => {
    expect(entryProblem('Landed', '2026-11-03')).toBeNull()
    expect(entryProblem('  ', '2026-11-03')).toMatch(/title/)
    expect(entryProblem('x'.repeat(101), '2026-11-03')).toMatch(/100/)
    expect(entryProblem('Landed', '')).toMatch(/date/)
    expect(entryProblem('Landed', '2026-13-45')).toMatch(/date/)
  })
  it("gives today's date as YYYY-MM-DD", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
