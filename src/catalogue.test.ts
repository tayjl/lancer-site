import { describe, expect, it, vi } from 'vitest'
import { cached, catalogueError, clearCatalogues } from './catalogue'

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
