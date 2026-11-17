import { describe, expect, it } from 'vitest'
import { CHANGED_ELSEWHERE, NOT_ALLOWED, OFFLINE, checkWrite } from './supabaseClient'

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
