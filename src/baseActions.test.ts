import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { BASE_ACTIONS, toBaseAction } from './baseActions'
import { baseActions } from './gameData'
import { coreContent } from './coreContent'
import { PILOT_ACTIONS } from './combatRules'
import { stepActions } from './combatEntries'
import { readLcp } from './lcp'

describe('base actions', () => {
  it('have unique ids and are all in the core content', () => {
    const ids = BASE_ACTIONS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(coreContent.items.filter(i => i.kind === 'actions').map(i => i.id)).toEqual(ids)
  })

  it('list for a pilot exactly what PILOT_ACTIONS does', () => {
    expect(BASE_ACTIONS.filter(a => a.pilot).map(a => a.name).sort()).toEqual(PILOT_ACTIONS.map(a => a.name).sort())
  })

  it('give the pilot its own Overwatch, and keep Jockey off the mech', () => {
    const overwatch = BASE_ACTIONS.filter(a => a.name === 'Overwatch')
    expect(overwatch.map(a => [a.id, a.mech, a.pilot])).toEqual([['act_overwatch_reaction', true, false], ['act_overwatch_pilot', false, true]])
    expect(BASE_ACTIONS.find(a => a.name === 'Jockey')).toMatchObject({ mech: false, pilot: true })
    expect(BASE_ACTIONS.find(a => a.name === 'Prepare')).toMatchObject({ mech: true, pilot: false, activation: 'Quick', group: 'other' })
  })

  it('drop hidden and nameless rows', () => {
    expect(toBaseAction('a', { name: 'Brace', hidden: true })).toBeNull()
    expect(toBaseAction('a', { name: ' ' })).toBeNull()
    expect(toBaseAction('a', { name: 'Brace', detail: 'x', mech: true, group: 'nope' })).toMatchObject({ name: 'Brace', text: 'x', mech: true, pilot: false, group: undefined })
  })

  it('fall back to the code lists when none are loaded', () => {
    expect(baseActions.value).toBe(BASE_ACTIONS)
    expect(stepActions('Reaction', [])[1].entries.map(e => e.name)).toContain('Brace')
    baseActions.value = BASE_ACTIONS.filter(a => a.name !== 'Brace')
    expect(stepActions('Reaction', [])[1].entries.map(e => e.name)).not.toContain('Brace')
    baseActions.value = BASE_ACTIONS
  })

  it('show an ungrouped Quick or Full action in Other', () => {
    baseActions.value = [{ id: 'z', name: 'Zeta stance', text: '', activation: 'Quick', mech: true, pilot: false }, { id: 'y', name: 'Yank', text: '', activation: 'Full', mech: true, pilot: false }]
    expect(stepActions('2 quick', []).find(g => g.title === 'Other')!.entries.map(e => e.name)).toEqual(['Zeta stance'])
    expect(stepActions('1 full', []).find(g => g.title === 'Other')!.entries.map(e => e.name)).toEqual(['Yank'])
    baseActions.value = BASE_ACTIONS
  })

  it('are ignored in an imported pack', async () => {
    const files = {
      'lcp_manifest.json': strToU8(JSON.stringify({ name: 'x', author: 'y', version: '1.0.0', description: '' })),
      'tags.json': strToU8(JSON.stringify([{ id: 't', name: 'T' }])),
      'actions.json': strToU8(JSON.stringify([{ id: 'a', name: 'A' }])),
    }
    const pack = await readLcp(zipSync(files))
    expect(pack.items.map(i => i.kind)).toEqual(['tags'])
    expect(pack.ignored).toContain('actions.json')
  })
})
