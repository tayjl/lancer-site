import { describe, expect, it } from 'vitest'
import { entryInfo, turnEntries, type CombatEntry } from './combatEntries'
import { COMBAT_TABS, FIGHT, JOCKEY, PILOT_ACTIONS, REACTIONS } from './combatRules'

describe('PILOT_ACTIONS', () => {
  const names = PILOT_ACTIONS.map((a) => a.name)
  it('has the on-foot set and nothing mech-only', () => {
    expect(names).toEqual(['Boost', 'Hide', 'Search', 'Activate', 'Reload', 'Skill check', 'Mount or dismount', 'Fight', 'Jockey', 'Improvised attack', 'Overwatch'])
    expect(names).not.toContain('Overcharge')
    expect(names).not.toContain('Core Power')
    expect(PILOT_ACTIONS.some((a) => /tech/i.test(a.name) || /tech/i.test(a.activation ?? ''))).toBe(false)
  })
  it('reuses the existing objects and takes the Quick Activate', () => {
    expect(PILOT_ACTIONS).toContain(FIGHT)
    expect(PILOT_ACTIONS).toContain(JOCKEY)
    expect(PILOT_ACTIONS).toContain(REACTIONS.find((a) => a.name === 'Overwatch'))
    expect(PILOT_ACTIONS.find((a) => a.name === 'Activate')?.activation).toBe('Quick')
  })
  it('has no dice words', () => {
    expect(FIGHT.text).not.toMatch(/roll|average/i)
  })
})

describe('COMBAT_TABS', () => {
  it('marks only Structure as mech only', () => {
    expect(COMBAT_TABS.filter((t) => t.on).map((t) => [t.id, t.on])).toEqual([['structure', 'mech']])
  })
})

describe('turnEntries', () => {
  it('keeps the mech turn as it was', () => {
    const { steps } = turnEntries(5, '1 Heat')
    expect(steps).toHaveLength(5)
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5])
    expect(steps[1].frequency).toBe('Speed 5')
    expect(steps[2].text).toMatch(/^<b>1 full action or 2 quick actions\.<\/b>/)
    expect(steps[3].heat).toBe('1 Heat')
  })
  it('leaves out Protocol and Overcharge for a pilot and renumbers', () => {
    const { steps } = turnEntries(4, null, true)
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3])
    expect(steps[0].name).toBe('Movement')
    expect(steps[0].frequency).toBe('Speed 4')
    expect(steps[0].text).toBe('Move using your Speed.')
    expect(steps[0].gist).toBe('Move using your Speed.')
    expect(turnEntries(5, null).steps[1].text).toBe("Move using your mech's Speed.")
    expect(steps[1].text).toMatch(/^<b>/)
    expect(steps.some((s) => s.activations?.includes('Protocol') || s.activations?.includes('Overcharge'))).toBe(false)
    expect(steps.every((s) => s.heat === undefined)).toBe(true)
  })
})

describe('entryInfo', () => {
  it('passes info() through', () => {
    const info = { kind: 'x', name: 'Kit', facts: [], stats: [], groups: [] }
    expect(entryInfo({ name: 'Other', info: () => info }, 'Card')).toBe(info)
  })
  it('builds one text card from a rules entry', () => {
    const entry: CombatEntry = { name: 'Boost', activation: 'Quick', text: 'Move again.' }
    expect(entryInfo(entry, 'Quick')).toEqual({ kind: 'Quick', name: 'Boost', facts: [], stats: [], groups: [{ cards: [{ heading: '', html: 'Move again.', activation: 'Quick' }] }] })
  })
  it('names an entry by value or tag, and copes with nothing', () => {
    expect(entryInfo({ value: 'Grit', text: 't' }, 'k').name).toBe('Grit')
    expect(entryInfo({ tag: 'Tag' }, 'k').name).toBe('Tag')
    const empty = entryInfo({}, 'k')
    expect(empty.name).toBe('')
    expect(empty.groups[0].cards[0].html).toBe('')
  })
})
