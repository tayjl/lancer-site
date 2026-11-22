import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const loadKind = vi.fn()
vi.mock('./catalogue', async (orig) => ({ ...(await orig<object>()), loadKind: (k: string) => loadKind(k) }))

describe('loading base actions and tags', () => {
  beforeEach(() => { vi.resetModules(); loadKind.mockReset() })

  it('keeps the seed and flags loaded when the load fails', async () => {
    loadKind.mockResolvedValue({ rows: null, error: new Error('x') })
    const g = await import('./gameData')
    const { BASE_ACTIONS } = await import('./baseActions')
    expect(g.baseActionsLoaded.value).toBe(false)
    await g.loadBaseActions()
    expect(g.baseActionsLoaded.value).toBe(true)
    expect(g.baseActions.value).toBe(BASE_ACTIONS)
  })

  it('uses the seed when there are no action rows', async () => {
    loadKind.mockResolvedValue({ rows: [], error: null })
    const g = await import('./gameData')
    const { BASE_ACTIONS } = await import('./baseActions')
    await g.loadBaseActions()
    expect(g.baseActions.value).toBe(BASE_ACTIONS)
  })

  it('gives an empty list when every action is hidden', async () => {
    loadKind.mockResolvedValue({ rows: [{ id: 'a', data: { name: 'A', hidden: true } }], error: null })
    const g = await import('./gameData')
    await g.loadBaseActions()
    expect(g.baseActions.value).toEqual([])
    expect(g.baseActionsLoaded.value).toBe(true)
  })

  it('flags tags loaded, also on error', async () => {
    loadKind.mockResolvedValue({ rows: null, error: new Error('x') })
    const g = await import('./gameData')
    expect(g.tagNamesLoaded.value).toBe(false)
    await g.loadTagNames()
    expect(g.tagNamesLoaded.value).toBe(true)
  })
})
