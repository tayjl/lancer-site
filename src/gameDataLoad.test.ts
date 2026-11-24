import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const loadKind = vi.fn()
const cached = vi.fn()
vi.mock('./catalogue', async (orig) => ({ ...(await orig<object>()), loadKind: (k: string) => loadKind(k), cached: (k: string) => cached(k) }))

describe('loading base actions and tags', () => {
  beforeEach(() => { vi.resetModules(); loadKind.mockReset() })

  it('stays empty and flags loaded when the load fails', async () => {
    loadKind.mockResolvedValue({ rows: null, error: new Error('x') })
    const g = await import('./gameData')
    expect(g.baseActionsLoaded.value).toBe(false)
    await g.loadBaseActions()
    expect(g.baseActionsLoaded.value).toBe(true)
    expect(g.baseActions.value).toEqual([])
  })

  it('gives an empty list when there are no action rows', async () => {
    loadKind.mockResolvedValue({ rows: [], error: null })
    const g = await import('./gameData')
    await g.loadBaseActions()
    expect(g.baseActions.value).toEqual([])
  })

  it('gives an empty list when every action is hidden', async () => {
    loadKind.mockResolvedValue({ rows: [{ id: 'a', data: { name: 'A', hidden: true } }], error: null })
    const g = await import('./gameData')
    await g.loadBaseActions()
    expect(g.baseActions.value).toEqual([])
    expect(g.baseActionsLoaded.value).toBe(true)
  })

  it('gives no rules on a load error or with no rule rows', async () => {
    for (const result of [{ rows: null, error: new Error('x') }, { rows: [], error: null }]) {
      vi.resetModules()
      loadKind.mockResolvedValue(result)
      const g = await import('./gameData')
      expect(g.rulesLoaded.value).toBe(false)
      await g.loadRules()
      expect(g.rulesLoaded.value).toBe(true)
      expect((await import('./rulesData')).ruleItems.value).toEqual([])
    }
  })

  it('gives no rules when every rule is hidden, and reads loaded ones', async () => {
    loadKind.mockResolvedValue({ rows: [{ id: 'a', data: { name: 'Fog', section: 'sizes', hidden: true } }, { id: 'b', data: { name: 'Mist', section: 'sizes', order: 1 } }], error: null })
    const g = await import('./gameData')
    const r = await import('./rulesData')
    await g.loadRules()
    expect(r.ruleRows('sizes').map((x) => x.value)).toEqual(['Mist'])
  })

  it('counts the loaded pilot stats as pilot bonuses', async () => {
    cached.mockResolvedValue({ rows: [{ id: 'grit', name: 'Grit' }], error: null })
    const g = await import('./gameData')
    const b = await import('./bonuses')
    expect(b.isPilotBonus('grit')).toBe(false)
    await g.loadPilotStats()
    expect(b.isPilotBonus('grit')).toBe(true)
    expect(b.isPilotBonus('physicality')).toBe(false)
    expect(b.isPilotBonus('pilot_hp') && b.isPilotBonus('mod_points')).toBe(true)
  })

  it('flags tags loaded, also on error', async () => {
    loadKind.mockResolvedValue({ rows: null, error: new Error('x') })
    const g = await import('./gameData')
    expect(g.tagNamesLoaded.value).toBe(false)
    await g.loadTagNames()
    expect(g.tagNamesLoaded.value).toBe(true)
  })
})
