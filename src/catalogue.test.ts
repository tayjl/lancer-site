import { describe, expect, it, vi } from 'vitest'
import { cached, catalogueError, clearCatalogues, loadKind } from './catalogue'

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

describe('loadKind', () => {
  it("hands over the campaign's edited version in place of the pack's, and leaves drafts out", async () => {
    clearCatalogues()
    const { rows: loaded } = await loadKind('tags')
    expect(loaded.map((row) => [row.id, row.data])).toEqual([['a', { name: 'Pack name' }], ['b', { name: 'Campaign name' }]])
    expect(filters).toContainEqual(['draft', false])
  })
})
