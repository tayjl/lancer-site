import { describe, expect, it } from 'vitest'
import { CHANGED_ELSEWHERE, NOT_ALLOWED, OFFLINE, checkWrite, fetchAll } from './supabaseClient'

const recheck = (updated_at: string | null) => ({ seen: 'v1', recheck: async () => ({ data: updated_at ? { updated_at } : null }) })

describe('checkWrite', () => {
  it('returns the written row', async () => {
    expect(await checkWrite({ data: [{ id: 1 }], error: null })).toEqual({ row: { id: 1 }, error: null })
  })
  it('passes on a database error', async () => {
    expect(await checkWrite({ data: null, error: { message: 'boom' } })).toEqual({ row: null, error: 'boom' })
  })
  it('words a dropped connection plainly, in every browser', async () => {
    for (const message of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'])
      expect((await checkWrite({ data: null, error: { message } })).error).toBe(OFFLINE)
  })
  it('treats zero rows as not allowed', async () => {
    expect(await checkWrite({ data: [], error: null })).toEqual({ row: null, error: NOT_ALLOWED })
  })
  it('reports a newer save when the row moved on', async () => {
    expect((await checkWrite({ data: [], error: null }, recheck('v2'))).error).toBe(CHANGED_ELSEWHERE)
  })
  it('reports not allowed when the guarded row is unchanged or gone', async () => {
    expect((await checkWrite({ data: [], error: null }, recheck('v1'))).error).toBe(NOT_ALLOWED)
    expect((await checkWrite({ data: [], error: null }, recheck(null))).error).toBe(NOT_ALLOWED)
  })
})

describe('fetchAll', () => {
  // A fake query over "total" rows that, like Supabase, never returns more than 1,000 at a time.
  const fake = (total: number, failOn?: number) => {
    const calls: number[] = []
    const page = async (from: number, to: number) => {
      calls.push(from)
      if (calls.length === failOn) return { data: null, error: { message: 'boom' } }
      return { data: Array.from({ length: Math.min(to + 1, total) - from }, (_, i) => from + i), error: null }
    }
    return { page, calls }
  }
  it('reads every page, in order', async () => {
    const { page, calls } = fake(2003)
    const { rows, error } = await fetchAll(page)
    expect(error).toBeNull()
    expect(rows).toHaveLength(2003)
    expect(rows[1000]).toBe(1000)
    expect(rows[2002]).toBe(2002)
    expect(calls).toEqual([0, 1000, 2000])
  })
  it('stops after a short page, and after an empty one', async () => {
    expect((await fetchAll(fake(3).page)).rows).toHaveLength(3)
    const exact = fake(1000)
    expect((await fetchAll(exact.page)).rows).toHaveLength(1000)
    expect(exact.calls).toEqual([0, 1000])
  })
  it('returns the error and no rows when a later page fails', async () => {
    expect(await fetchAll(fake(2003, 2).page)).toEqual({ rows: [], error: 'boom' })
  })
})
