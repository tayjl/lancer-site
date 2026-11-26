import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCatalogues } from './catalogue'
import { loadIds, loadStats, saveItem, type Loaded } from './editorStore'
import { CHANGED_ELSEWHERE, NOT_ALLOWED } from './lib/supabaseClient'

// A fake query: every filter returns itself, a list read (range) answers with "list", awaiting a write answers with
// "write", and the updated_at recheck (maybeSingle) answers with "recheck".
const fake = vi.hoisted(() => ({
  list: { data: [] as unknown[] | null, error: null as { message: string } | null },
  write: { data: null as unknown[] | null, error: null as { message: string } | null },
  recheck: { data: null as { updated_at: string } | null },
  reads: 0,
}))
vi.mock('./lib/supabaseClient', async (importOriginal) => {
  const query: Record<string, unknown> = {
    select: () => query,
    update: () => query,
    eq: () => query,
    order: () => query,
    range: async () => (fake.reads++, fake.list),
    maybeSingle: async () => fake.recheck,
    then: (resolve: (value: unknown) => void) => resolve(fake.write),
  }
  const from = () => query
  // The real helper reads through the real client, so the fake stands in for it too.
  return { ...(await importOriginal<typeof import('./lib/supabaseClient')>()), recheckUpdatedAt: () => query.maybeSingle, supabase: { from } }
})

beforeEach(() => {
  clearCatalogues()
  fake.list = { data: [], error: null }
  fake.write = { data: null, error: null }
  fake.recheck = { data: null }
  fake.reads = 0
})

describe('loadIds and loadStats', () => {
  it('read the ids in use, and share one read', async () => {
    fake.list = { data: [{ id: 'a' }, { id: 'b' }], error: null }
    expect([...(await loadIds())]).toEqual(['a', 'b'])
    await loadIds()
    expect(fake.reads).toBe(1)
  })
  it('fail instead of returning an empty set that passes every id as unused', async () => {
    fake.list = { data: null, error: { message: 'boom' } }
    await expect(loadIds()).rejects.toThrow('boom')
    await expect(loadStats()).rejects.toThrow('boom')
  })
  it('say offline in plain words', async () => {
    fake.list = { data: null, error: { message: 'Failed to fetch' } }
    await expect(loadIds()).rejects.toThrow("Can't reach the server")
  })
})

describe('saveItem on a faction', () => {
  const item: Loaded = { key: '1', kind: 'factions', packId: null, draft: false, edited: null, data: {}, updatedAt: 't1' }
  const edits = { name: 'Union' }

  it('returns the new updated_at', async () => {
    fake.write = { data: [{ updated_at: 't2' }], error: null }
    expect(await saveItem(item, edits, false)).toEqual({ updatedAt: 't2' })
  })
  it('reports a save that someone else got in first', async () => {
    fake.recheck = { data: { updated_at: 't9' } }
    expect(await saveItem(item, edits, false)).toEqual({ error: CHANGED_ELSEWHERE })
  })
  it('reports a refusal when the row is unchanged', async () => {
    fake.recheck = { data: { updated_at: 't1' } }
    expect(await saveItem(item, edits, false)).toEqual({ error: NOT_ALLOWED })
  })
  it('reports a failed write', async () => {
    fake.write = { data: null, error: { message: 'boom' } }
    expect(await saveItem(item, edits, false)).toEqual({ error: 'boom' })
  })
})
