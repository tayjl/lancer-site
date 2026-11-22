import { describe, expect, it } from 'vitest'
import { actionKey, entryInfo, stepActions, turnEntries, type CombatEntry, type KitAction } from './combatEntries'
import { FIGHT, FULL_ACTIONS, IMPROVISED, JOCKEY, OVERCHARGE, PILOT_ACTIONS, QUICK_ACTIONS, REACTIONS, TURN_STEPS } from './combatRules'

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

describe('turnEntries', () => {
  it('keeps the mech turn as it was', () => {
    const { steps } = turnEntries(5, '1 Heat')
    expect(steps).toHaveLength(6)
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6])
    expect(steps[1].frequency).toBe('Speed 5')
    expect(steps[2].text).toMatch(/^<b>1 full action or 2 quick actions\.<\/b>/)
    expect(steps[3].heat).toBe('1 Heat')
  })
  it('leaves out Protocol and Overcharge for a pilot and renumbers', () => {
    const { steps } = turnEntries(4, null, true)
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4])
    expect(steps[0].name).toBe('Movement')
    expect(steps[0].frequency).toBe('Speed 4')
    expect(steps[0].text).toBe('Move using your Speed.')
    expect(steps[0].gist).toBe('Move using your Speed.')
    expect(turnEntries(5, null).steps[1].text).toBe("Move using your mech's Speed.")
    expect(steps[1].text).toMatch(/^<b>/)
    expect(steps[2].activations).toEqual(['Free'])
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

describe('actionKey', () => {
  it('sorts by chip colour, with Overcharge and no chip as free', () => {
    expect(actionKey('Quick')).toBe('quick')
    expect(actionKey('Quick Tech')).toBe('tech')
    expect(actionKey('Overcharge')).toBe('free')
    expect(actionKey(undefined)).toBe('free')
  })
})

describe('stepActions', () => {
  const STEP = '1 full action or 2 quick actions'
  const kit = (name: string, activation: string, block = 'systems'): KitAction => ({ name, activation, key: actionKey(activation), block })
  const mine = [kit('Jump jets', 'Quick'), kit('Big gun', 'Full'), kit('Hack', 'Quick Tech'), kit('Wake', 'Protocol'), kit('Perk', 'Free'), kit('Guard', 'Reaction'), kit('Pilot quick', 'Quick', 'gear'), kit('Pilot proto', 'Protocol', 'gear')]
  const titles = (name: string, pilot = false) => stepActions(name, mine, pilot).map((g) => g.title)
  const names = (name: string, pilot = false) => stepActions(name, mine, pilot).flatMap((g) => g.entries.map((e) => e.name))

  it('names the steps and the full or quick step groups in order for a mech', () => {
    expect(TURN_STEPS.map((s) => s.name)).toEqual(['Protocol', 'Movement', STEP, 'Overcharge', 'Free', 'Reaction'])
    expect(titles(STEP)).toEqual(['Attacks', 'Movement', 'Tech', 'Systems', 'Your mech', 'Your kit'])
    expect(names(STEP).slice(-4)).toEqual(['Jump jets', 'Big gun', 'Hack', 'Pilot quick'])
  })
  it('gives the other steps their own groups', () => {
    expect(names('Protocol')).toEqual(['Wake', 'Pilot proto'])
    expect(names('Movement')).toEqual(['Boost', 'Disengage'])
    expect(names('Overcharge')).toEqual(['Overcharge'])
    expect(stepActions('Overcharge', [], false, '2 Heat')[0].entries[0].heat).toBe('2 Heat')
    expect(stepActions('Overcharge', [])[0].entries[0].text).toMatch(/After the 4th use/)
    expect(names('Free')).toEqual(['Core Power', 'Perk'])
    expect(names('Reaction')).toEqual(['Brace', 'Overwatch', 'Reaction systems', 'Guard'])
    expect(stepActions('Nope', mine)).toEqual([])
  })
  it('keeps only on-foot actions and gear in pilot mode', () => {
    expect(titles(STEP, true)).toEqual(['Attacks', 'Movement', 'Systems', 'Your kit'])
    expect(names(STEP, true)).toContain('Fight')
    expect(names(STEP, true)).not.toContain('Barrage')
    expect(names(STEP, true).slice(-1)).toEqual(['Pilot quick'])
    expect(names('Protocol', true)).toEqual(['Pilot proto'])
    expect(names('Movement', true)).toEqual(['Boost'])
    expect(stepActions('Overcharge', [], true)).toEqual([])
    expect(names('Free', true)).toEqual([])
    expect(names('Reaction', true)).toEqual(['Overwatch'])
  })
  it('leaves empty groups out', () => {
    expect(stepActions('Protocol', [])).toEqual([])
    expect(titles(STEP).includes('Your kit')).toBe(true)
    expect(stepActions(STEP, []).map((g) => g.title)).not.toContain('Your kit')
  })
  it('shows every mech action in exactly one step, apart from Boost and Disengage that also head Movement', () => {
    const all = TURN_STEPS.flatMap((s) => stepActions(s.name, [], false).flatMap((g) => g.entries.map((e) => `${e.name}|${e.activation}`)))
    const twice = ['Boost|Quick', 'Disengage|Full']
    for (const a of [...QUICK_ACTIONS, ...FULL_ACTIONS, IMPROVISED, JOCKEY, ...REACTIONS, OVERCHARGE]) {
      expect(all.filter((k) => k === `${a.name}|${a.activation}`), a.name).toHaveLength(twice.includes(`${a.name}|${a.activation}`) ? 2 : 1)
    }
    expect(all).not.toContain('Fight|Full')
  })
  it('gives every grouped action a group, and Core Power and reactions none', () => {
    for (const a of [...QUICK_ACTIONS, ...FULL_ACTIONS.filter((x) => x.name !== 'Core Power'), IMPROVISED, JOCKEY, FIGHT]) expect(a.group, a.name).toBeTruthy()
    expect([...REACTIONS, OVERCHARGE, FULL_ACTIONS.find((x) => x.name === 'Core Power')!].some((a) => a.group)).toBe(false)
  })
})
