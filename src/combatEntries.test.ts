import { describe, expect, it } from 'vitest'
import { actionKey, entryInfo, rulesTopics, stepActions, turnEntries, type CombatEntry, type KitAction } from './combatEntries'
import {
  ATTACK_EXTRAS, ATTACK_FORMULAS, ATTACK_RESULTS, AREAS, AURAS, AURAS_NOTE, CHECK_FORMULAS, CHECK_RESULTS, CONVERSIONS_NOTE, COVER_NOTE, DAMAGE_FORMULAS, DEFENCES, DICE, DICE_NOTE, DRONES_NOTE, FIGHT, FOOT_RULES,
  FULL_ACTIONS, IMPROVISED, JOCKEY, KNOCKBACK, KNOCKBACK_NOTE, MOVEMENT_NOTE, OVERCHARGE, PILOT_ACTIONS, PILOT_CHECKS_NOTE, PILOT_DCS, PILOT_OVERWATCH, PUSHING_THROUGH, QUICK_ACTIONS, RANGE_BONUSES, RANGE_TALENTS, RANGE_TIERS, REACTIONS,
  RECHARGE, REPAIRS, RESOURCES_NOTE, RESULTS_NOTE, SCENE_RESOURCES, SENSORS, SENSORS_NOTE, SIZE_NOTE, SPEED_GATEWAYS, STRUCTURE_NOTE, STRUCTURE_STRESS, STRUCTURE_TRIGGERS, TECH_NOTE, TERRAIN, TURN_STEPS, type CombatRow,
} from './combatRules'

describe('PILOT_ACTIONS', () => {
  const names = PILOT_ACTIONS.map((a) => a.name)
  it('has the on-foot set and nothing mech-only', () => {
    expect(names).toEqual(['Boost', 'Hide', 'Search', 'Activate', 'Reload', 'Skill check', 'Mount or dismount', 'Fight', 'Jockey', 'Improvised attack', 'Overwatch'])
    expect(names).not.toContain('Overcharge')
    expect(names).not.toContain('Core power rules')
    expect(PILOT_ACTIONS.some((a) => /tech/i.test(a.name) || /tech/i.test(a.activation ?? ''))).toBe(false)
  })
  it('reuses the existing objects and takes the Quick Activate', () => {
    expect(PILOT_ACTIONS).toContain(FIGHT)
    expect(PILOT_ACTIONS).toContain(JOCKEY)
    expect(PILOT_ACTIONS).toContain(PILOT_OVERWATCH)
    expect(PILOT_ACTIONS).not.toContain(REACTIONS.find((a) => a.name === 'Overwatch'))
    expect(PILOT_OVERWATCH.text).toMatch(/pilot weapon/)
    expect(PILOT_ACTIONS.find((a) => a.name === 'Activate')?.activation).toBe('Quick')
  })
  it('has no dice words', () => {
    expect(FIGHT.text).not.toMatch(/roll|average/i)
  })
})

describe('turnEntries', () => {
  it('keeps the mech turn as it was, with full and quick as two steps', () => {
    const { steps } = turnEntries(5, '1 Heat')
    expect(steps).toHaveLength(7)
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(steps[1].frequency).toBe('Speed 5')
    expect(steps[2].text).toMatch(/^<b>1 full\.<\/b>/)
    expect(steps[3].text).toMatch(/^<b>2 quick\.<\/b>/)
    expect(steps[4].heat).toBe('1 Heat')
  })
  it('leaves out Protocol and Overcharge for a pilot and renumbers', () => {
    const { steps } = turnEntries(4, null, true)
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5])
    expect(steps[0].name).toBe('Movement')
    expect(steps[0].frequency).toBe('Speed 4')
    expect(steps[0].text).toBe('Move using your Speed.')
    expect(steps[0].gist).toBe('Move using your Speed.')
    expect(turnEntries(5, null).steps[1].text).toBe("Move using your mech's Speed.")
    expect(steps[1].text).toMatch(/^<b>/)
    expect(steps[3].activations).toEqual(['Free'])
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
  const kit = (name: string, activation: string, block = 'systems'): KitAction => ({ name, activation, key: actionKey(activation), block })
  const mine = [kit('Jump jets', 'Quick'), kit('Big gun', 'Full'), kit('Hack', 'Quick Tech'), kit('Deep hack', 'Full Tech'), kit('Wake', 'Protocol'), kit('Perk', 'Free'), kit('Guard', 'Reaction'), kit('Pilot quick', 'Quick', 'gear'), kit('Pilot proto', 'Protocol', 'gear')]
  const titles = (name: string, pilot = false) => stepActions(name, mine, pilot).map((g) => g.title)
  const names = (name: string, pilot = false, group?: string) => stepActions(name, mine, pilot).filter((g) => !group || g.title === group).flatMap((g) => g.entries.map((e) => e.name))

  it('has the steps in order, with full and quick separate', () => {
    expect(TURN_STEPS.map((s) => s.name)).toEqual(['Protocol', 'Movement', '1 full', '2 quick', 'Overcharge', 'Free', 'Reaction'])
    expect(titles('1 full')).toEqual(['Attacks', 'Tech', 'Other', 'Your kit'])
    expect(titles('2 quick')).toEqual(['Attacks', 'Tech', 'Other', 'Your kit'])
  })
  it('sorts the quick and full cards, and each tech action shows by itself', () => {
    expect(names('2 quick', false, 'Attacks')).toEqual(['Skirmish', 'Ram', 'Grapple'])
    expect(names('2 quick', false, 'Tech')).toEqual(['Invade', 'Lock on', 'Bolster', 'Scan', 'Hack'])
    expect(names('2 quick', false, 'Your kit')).toEqual(['Jump jets'])
    expect(names('1 full', false, 'Attacks')).toEqual(['Barrage', 'Improvised attack'])
    expect(names('1 full', false, 'Tech')).toEqual(['Full tech', 'Deep hack'])
    expect(names('1 full', false, 'Your kit')).toEqual(['Big gun'])
    expect(names('1 full', false, 'Other')).not.toContain('Boost')
  })
  it('shows gear kit actions in Pilot mode only, and mech ones in Mech mode only', () => {
    expect(names('2 quick', true, 'Your kit')).toEqual(['Pilot quick'])
    expect(names('2 quick', false, 'Your kit')).not.toContain('Pilot quick')
    expect(names('Protocol', true, 'Protocols')).toEqual(['Pilot proto'])
    expect(names('Protocol', false, 'Protocols')).toEqual(['Wake'])
    expect(names('2 quick', true, 'Your kit')).not.toContain('Jump jets')
  })
  it('lists Fight as a Quick action only with a Sidearm weapon', () => {
    const quick = (sidearm: boolean) => stepActions('2 quick', [], true, null, sidearm).find((g) => g.title === 'Attacks')!.entries
    expect(quick(false).map((e) => e.name)).not.toContain('Fight')
    const fight = quick(true).find((e) => e.name === 'Fight')!
    expect(fight.activation).toBe('Quick')
    expect(fight.text).toContain('Needs a Sidearm weapon.')
    expect(stepActions('1 full', [], true, null, true).flatMap((g) => g.entries.map((e) => e.name))).toContain('Fight')
    expect(stepActions('2 quick', [], false, null, true).flatMap((g) => g.entries.map((e) => e.name))).not.toContain('Fight')
  })
  it('lists kit tech actions in the Tech card, not Your kit', () => {
    const gear = [kit('Hack', 'Quick Tech'), kit('Pilot hack', 'Quick Tech', 'gear'), kit('Jump jets', 'Quick')]
    const tech = (pilot: boolean, title: string) => stepActions('2 quick', gear, pilot).find((g) => g.title === title)!.entries.map((e) => e.name)
    expect(tech(false, 'Tech')).toContain('Hack')
    expect(tech(false, 'Tech')).not.toContain('Pilot hack')
    expect(tech(true, 'Tech')).toEqual(['Pilot hack'])
    expect(tech(false, 'Your kit')).toEqual(['Jump jets'])
    expect(tech(true, 'Your kit')).toEqual([])
  })
  it('colours the cards', () => {
    expect(stepActions('2 quick', []).map((g) => g.colour)).toEqual(['quick', 'tech', 'quick', 'quick'])
    expect(stepActions('1 full', []).map((g) => g.colour)).toEqual(['full', 'tech', 'full', 'full'])
    expect(stepActions('Protocol', []).every((g) => g.colour === 'protocol')).toBe(true)
  })
  it('gives Movement its gateways and a Move further card with costs', () => {
    const [how, further] = stepActions('Movement', mine)
    expect(how.text).toBe('Move up to your Speed.')
    expect(how.entries.map((e) => e.value)).toEqual(['Any', '5+', '6+'])
    expect(further.entries.map((e) => [e.name, e.cost])).toEqual([['Boost', '1 quick'], ['Disengage', '1 full']])
    expect(stepActions('Movement', mine, true)[1].entries.map((e) => e.name)).toEqual(['Boost'])
  })
  it('gives Overcharge text and heat data and no chips', () => {
    const [how, heat] = stepActions('Overcharge', [])
    expect(how.text).toMatch(/After the 4th use/)
    expect(heat.heat).toEqual({ steps: ['1', '2', '4', '6'], custom: false })
    expect(stepActions('Overcharge', [], false, '1 → 2 → 3')[1].heat).toEqual({ steps: ['1', '2', '3'], custom: true })
    expect(stepActions('Overcharge', []).flatMap((g) => g.entries)).toEqual([])
    expect(stepActions('Overcharge', [], true)).toEqual([])
  })
  it('gives the other steps a how-it-works card and their actions', () => {
    expect(names('Protocol')).toEqual(['Wake'])
    expect(names('Free')).toEqual(['Perk'])
    expect(names('Reaction')).toEqual(['Brace', 'Overwatch', 'Reaction systems', 'Guard'])
    for (const step of ['Protocol', 'Free', 'Reaction']) expect(stepActions(step, mine)[0].title).toBe('How it works')
    expect(stepActions('Nope', mine)).toEqual([])
  })
  it('never returns a blank card', () => {
    for (const pilot of [false, true]) {
      for (const step of TURN_STEPS.map((s) => s.name)) {
        for (const g of stepActions(step, [], pilot)) expect(g.entries.length || g.text || g.heat || g.empty, `${step} ${g.title} ${pilot}`).toBeTruthy()
      }
    }
  })
  it('keeps only on-foot actions and gear in pilot mode', () => {
    expect(names('2 quick', true, 'Your kit')).toEqual(['Pilot quick'])
    expect(names('1 full', true)).toContain('Fight')
    expect(names('1 full', true)).not.toContain('Barrage')
    expect(names('Protocol', true)).toEqual(['Pilot proto'])
    expect(names('Free', true)).toEqual([])
    expect(names('Reaction', true)).toEqual(['Overwatch'])
  })
  it('keeps empty cards with their message', () => {
    expect(stepActions('Protocol', [])[1]).toMatchObject({ entries: [], empty: 'No protocols.' })
    expect(stepActions('Free', [], true)[1]).toMatchObject({ entries: [], empty: 'No free actions.' })
    expect(stepActions('Reaction', [], true)[1].entries).toHaveLength(1)
    expect(stepActions('1 full', []).at(-1)).toMatchObject({ title: 'Your kit', entries: [], empty: 'No kit actions.' })
    expect(stepActions('2 quick', [], true)[1]).toMatchObject({ title: 'Tech', entries: [], empty: 'No tech actions.' })
    expect(stepActions('Reaction', [])[1].empty).toBe('No reactions.')
  })
  it('shows every mech action in exactly one step, and no generic Quick tech', () => {
    const list = TURN_STEPS.flatMap((s) => stepActions(s.name, [], false).flatMap((g) => g.entries.map((e) => e.name)))
    for (const a of [...QUICK_ACTIONS, ...FULL_ACTIONS.filter((x) => x.name !== 'Core power rules'), IMPROVISED, ...REACTIONS]) {
      expect(list.filter((n) => n === a.name), a.name).toHaveLength(a.name === 'Activate' ? 2 : 1) // Activate has a quick and a full version
    }
    expect(list).not.toContain('Quick tech')
    expect(list).not.toContain('Fragment signal')
    expect(list).not.toContain('Fight')
    expect(list).not.toContain('Overcharge')
  })
  it('lists Prepare as a mech Quick action in Other, and Jockey for pilots only', () => {
    expect(names('2 quick', false, 'Other')).toContain('Prepare')
    expect(names('2 quick', true)).not.toContain('Prepare')
    expect(names('1 full', false)).not.toContain('Jockey')
    expect(names('1 full', true)).toContain('Jockey')
  })
  it('gives Overcharge kit actions to the Overcharge step, not Free', () => {
    const boost = kit('Surge', 'Overcharge')
    const withBoost = [...mine, boost]
    expect(stepActions('Overcharge', withBoost)[1].entries.map((e) => e.name)).toEqual(['Surge'])
    expect(stepActions('Free', withBoost).flatMap((g) => g.entries.map((e) => e.name))).not.toContain('Surge')
  })
  it('falls back to the Free step for an activation it does not know', () => {
    expect(stepActions('Free', [...mine, kit('Odd', 'Sometimes')]).flatMap((g) => g.entries.map((e) => e.name))).toContain('Odd')
  })
  it('explains Quick Tech and Full Tech on the Tech card', () => {
    expect(stepActions('2 quick', []).find((g) => g.title === 'Tech')!.text).toBe(TECH_NOTE)
    expect(stepActions('2 quick', []).find((g) => g.title === 'Attacks')!.text).toBeUndefined()
  })
  it('marks Scan, Lock on and Bolster as Quick Tech, and has one Invade', () => {
    for (const n of ['Scan', 'Lock on', 'Bolster']) expect(QUICK_ACTIONS.find((a) => a.name === n)?.activation).toBe('Quick Tech')
    expect(QUICK_ACTIONS.filter((a) => a.name === 'Invade' || a.name === 'Quick tech' || a.name === 'Fragment signal').map((a) => a.name)).toEqual(['Invade'])
  })
  it('gives every grouped action a group, and Core Power and reactions none', () => {
    for (const a of [...QUICK_ACTIONS, ...FULL_ACTIONS.filter((x) => x.name !== 'Core power rules'), IMPROVISED, JOCKEY, FIGHT]) expect(a.group, a.name).toBeTruthy()
    expect([...REACTIONS, OVERCHARGE, FULL_ACTIONS.find((x) => x.name === 'Core power rules')!].some((a) => a.group)).toBe(false)
    expect([...QUICK_ACTIONS, ...FULL_ACTIONS].filter((a) => a.group === 'move').map((a) => a.name)).toEqual(['Boost', 'Disengage'])
  })
  it('has no dice words in the actions', () => {
    for (const a of [...QUICK_ACTIONS, ...FULL_ACTIONS, ...TURN_STEPS]) expect(`${a.text} ${a.gist}`, a.name).not.toMatch(/\broll|average|\dd\d/i)
  })
})

describe('rulesTopics', () => {
  const REPAIR = 'Lodestar: 1 Repair restores 1 Structure.'
  const cards = (pilot: boolean) => rulesTopics(pilot, REPAIR)
  const names = (pilot: boolean) => cards(pilot).flatMap((c) => c.topics.map((t) => t.name))
  const text = (pilot: boolean) => cards(pilot).flatMap((c) => c.topics.map((t) => t.text)).join(' ')

  it('has the four cards in order', () => {
    expect(cards(false).map((c) => c.title)).toEqual(['Checks and resources', 'Attacks and damage', 'Movement and range', 'Structure and repairs'])
    expect(cards(true).map((c) => c.title)).toEqual(cards(false).map((c) => c.title))
  })
  it('trims by mode', () => {
    expect(names(false)).toEqual(expect.arrayContaining(['Dice conversions', 'Defence baselines', 'Structure and stress', 'Rest', 'Full Repair', 'Pilots and drones']))
    expect(names(false)).not.toContain('Pilot checks')
    expect(names(true)).toEqual(expect.arrayContaining(['Pilot checks', 'Pilot attacks', 'Attacks on a pilot', 'Pilot stats', 'Mech destroyed', 'Melt down']))
    for (const n of ['Dice conversions', 'Defence baselines', 'Structure and stress', 'Rest']) expect(names(true)).not.toContain(n)
  })
  it('opens each topic as stacked cards', () => {
    for (const card of [...cards(false), ...cards(true)]) for (const t of card.topics) {
      const info = t.info()
      expect(info.name).toBe(t.name)
      expect(info.groups[0].stack).toBe(true)
      expect(info.groups[0].cards.length, t.name).toBeGreaterThan(0)
      expect(t.text, t.name).toContain(t.name)
    }
  })
  it('adds the repair line to Rest only when given', () => {
    const rest = (line?: string) => rulesTopics(false, line)[3].topics.find((t) => t.name === 'Rest')!.text
    expect(rest(REPAIR)).toContain('Lodestar')
    expect(rest()).not.toContain('Lodestar')
  })
  it('reaches every rule constant the page used, in its mode', () => {
    const mech = text(false)
    const pilot = text(true)
    const lists: CombatRow[][] = [CHECK_RESULTS, ATTACK_EXTRAS, SPEED_GATEWAYS, TERRAIN, KNOCKBACK, AREAS, RANGE_TIERS, SENSORS, AURAS, RANGE_BONUSES, RANGE_TALENTS, REPAIRS, FOOT_RULES]
    for (const r of lists.flat()) expect(mech, r.value).toContain(r.text)
    for (const r of [...DICE, ...RECHARGE]) expect(mech, r.value).toContain(r.value)
    for (const r of [...PILOT_DCS, ...ATTACK_EXTRAS, FOOT_RULES[1], FOOT_RULES[2]]) expect(pilot, r.value).toContain(r.text)
    for (const f of [...CHECK_FORMULAS, ...ATTACK_FORMULAS, ...DAMAGE_FORMULAS]) expect(mech).toContain(f.example)
    for (const r of ATTACK_RESULTS) expect(mech).toContain(r.physical[1])
    for (const r of SCENE_RESOURCES) expect(mech).toContain(r.text)
    for (const t of STRUCTURE_TRIGGERS) expect(mech).toContain(t.text)
    for (const s of STRUCTURE_STRESS) expect(mech).toContain(s.stress)
    for (const d of DEFENCES) expect(mech).toContain(d.mech)
    for (const n of [RESOURCES_NOTE, RESULTS_NOTE, PUSHING_THROUGH, MOVEMENT_NOTE, KNOCKBACK_NOTE, SENSORS_NOTE, AURAS_NOTE, COVER_NOTE, CONVERSIONS_NOTE, DICE_NOTE, STRUCTURE_NOTE, DRONES_NOTE, SIZE_NOTE]) expect(mech).toContain(n)
    expect(pilot).toContain(PILOT_CHECKS_NOTE)
    expect(pilot).not.toContain(DICE_NOTE)
  })
  it('shows Core power rules as a mech Rules topic, not a step action', () => {
    expect(names(false)).toContain('Core power')
    expect(names(true)).not.toContain('Core power')
    expect(TURN_STEPS.flatMap((s) => stepActions(s.name, [], false).flatMap((g) => g.entries.map((e) => e.name)))).not.toContain('Core power rules')
  })
  it('has no "roll" or "average"', () => {
    expect(text(false) + text(true)).not.toMatch(/\broll|average/i)
  })
})
