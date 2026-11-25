import { describe, expect, it, vi } from 'vitest'
import { cached, catalogueError, catalogueLoading, clearCatalogues, loadKind, retryCatalogues, retrying } from './catalogue'

// loadKind reads content_items through supabase-js: this fake query records the filters and answers with fixed rows.
const filters: [string, unknown][] = []
const rows = [
  { id: 'a', kind: 'tags', data: { name: 'Pack name' }, edited: null },
  { id: 'b', kind: 'tags', data: { name: 'Pack name' }, edited: { name: 'Campaign name' } },
]
vi.mock('./lib/supabaseClient', async (importOriginal) => {
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => (filters.push([column, value]), query),
    order: () => query,
    range: async () => ({ data: rows, error: null }),
  }
  return { ...(await importOriginal<typeof import('./lib/supabaseClient')>()), supabase: { from: () => query } }
})

describe('cached', () => {
  it('loads once and shares the result', async () => {
    clearCatalogues()
    const load = vi.fn(async () => ({ rows: [1], error: null }))
    await Promise.all([cached('a', load), cached('a', load)])
    await cached('a', load)
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('loads again after clearCatalogues', async () => {
    clearCatalogues()
    const load = vi.fn(async () => ({ rows: [1], error: null }))
    await cached('b', load)
    clearCatalogues()
    await cached('b', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('does not keep a failure: the next ask retries, and a success clears the error', async () => {
    clearCatalogues()
    const load = vi.fn<() => Promise<{ rows: number[]; error: string | null }>>()
    load.mockResolvedValueOnce({ rows: [], error: 'boom' })
    await cached('c', load)
    expect(catalogueError.value).toBe('boom')
    load.mockResolvedValueOnce({ rows: [2], error: null })
    expect((await cached('c', load)).rows).toEqual([2])
    expect(catalogueError.value).toBe('')
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('retryCatalogues', () => {
  // Starts a retry the way a page does: the watchers read again, here one cached read.
  async function retryWith(load: () => Promise<{ rows: number[]; error: string | null }>) {
    clearCatalogues()
    const retry = retryCatalogues()
    expect(retrying.value).toBe(true)
    await retry
    const read = cached('retry', load).catch(() => 'threw')
    expect(catalogueLoading.value).toBe(true)
    await read
    expect(catalogueLoading.value).toBe(false)
  }
  it('holds while the reads run, and lets go on success', async () => {
    await retryWith(async () => ({ rows: [1], error: null }))
    expect(retrying.value).toBe(false)
  })
  it('lets go on a failed read, and keeps the error', async () => {
    await retryWith(async () => ({ rows: [], error: 'boom' }))
    expect(retrying.value).toBe(false)
    expect(catalogueError.value).toBe('boom')
  })
  it('lets go when a load throws, and asks again next time', async () => {
    const load = vi.fn<() => Promise<{ rows: number[]; error: string | null }>>().mockRejectedValueOnce(new Error('network'))
    await retryWith(load)
    expect(retrying.value).toBe(false)
    load.mockResolvedValueOnce({ rows: [1], error: null })
    expect((await cached('retry', load)).rows).toEqual([1])
  })
  it('lets go at once when nothing reads', async () => {
    clearCatalogues()
    await retryCatalogues()
    expect(retrying.value).toBe(false)
  })
  it('drops a stale failure for a key the page no longer reads', async () => {
    clearCatalogues()
    await cached('stale', async () => ({ rows: [], error: 'old' }))
    expect(catalogueError.value).toBe('old')
    const retry = retryCatalogues()
    expect(catalogueError.value).toBe('')
    expect(retrying.value).toBe(true) // the notice reads "Loading…" until the reads settle
    await retry
    expect(catalogueError.value).toBe('')
  })
  it('brings a failure back when the read fails again', async () => {
    clearCatalogues()
    await cached('again', async () => ({ rows: [], error: 'old' }))
    await retryWith(async () => ({ rows: [], error: 'still down' }))
    expect(catalogueError.value).toBe('still down')
  })
})

describe('loadKind', () => {
  it("hands over the campaign's edited version in place of the pack's, and leaves drafts out", async () => {
    clearCatalogues()
    const { rows: loaded } = await loadKind('tags')
    expect(loaded.map((row) => [row.id, row.data])).toEqual([['a', { name: 'Pack name' }], ['b', { name: 'Campaign name' }]])
    expect(filters).toContainEqual(['draft', false])
  })
})
