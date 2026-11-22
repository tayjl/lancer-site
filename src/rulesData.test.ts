import { afterEach, describe, expect, it } from 'vitest'
import { coreContent } from './coreContent'
import { stepActions, rulesTopics, turnEntries } from './combatEntries'
import { blankItem, validateItem } from './contentEditor'
import { mechResources } from './mechData'
import { RULES_SEED, SECTIONS, onFootRows, ruleItems, ruleNote, ruleNumbers, ruleRows, ruleTagIds, statusGroups, toRuleItem, turnSteps, type RuleItem } from './rulesData'
import type { Sheet } from './myPilot'

const topicText = (pilot = false) => rulesTopics(pilot).flatMap((c) => c.topics.map((t) => t.text)).join(' ')
const item = (over: Partial<RuleItem>): RuleItem => ({ id: 'hb_rule_x', name: 'X', section: 'notes', text: '', order: 5, ...over })

describe('rules seed', () => {
  afterEach(() => { ruleItems.value = RULES_SEED })

  it('has unique ids, valid sections and groups, and is in the core content', () => {
    const ids = RULES_SEED.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RULES_SEED) {
      const section = SECTIONS.find((s) => s.id === r.section)
      expect(section, r.id).toBeTruthy()
      expect(r.id, r.id).toMatch(/^rule_[a-z_]+_[a-z0-9_]*[a-z0-9]$/)
      if (section!.groups) expect(section!.groups.map((g) => g.id), r.id).toContain(r.group)
      expect(validateItem('rules', r as never, { id: r.id } as never), r.id).toEqual([])
    }
    expect(coreContent.items.filter((i) => i.kind === 'rules').map((i) => i.id)).toEqual(ids)
  })

  it('falls back to the seed numbers and keeps the page working', () => {
    expect(ruleNumbers('overcharge_heat')).toEqual([1, 2, 4, 6])
    expect(ruleNote('overcharge_later')).toContain('stays at 6 Heat')
    expect(ruleTagIds()).toContain('tg_accurate')
    expect(statusGroups().map((g) => g.rows.length)).toEqual([6, 7, 7])
    expect(onFootRows().map((r) => r.value)).toEqual(['Down and out (pilot status)', 'Mech destroyed', 'Melt down'])
  })

  it('drops hidden items and sorts by order', () => {
    ruleItems.value = [item({ id: 'a', name: 'Late', section: 'sizes', order: 20 }), item({ id: 'b', name: 'Early', section: 'sizes', order: 10 }), item({ id: 'c', name: 'Gone', section: 'sizes', hidden: true })]
    expect(ruleRows('sizes').map((r) => r.value)).toEqual(['Early', 'Late'])
  })

  it('drives Overcharge heat and the repair cost from the numbers', () => {
    ruleItems.value = [...RULES_SEED.filter((r) => r.section !== 'numbers'), item({ id: 'rule_numbers_overcharge_heat', section: 'numbers', numbers: [2, 3, 5, 9] }), item({ id: 'rule_numbers_repair_cost', section: 'numbers', numbers: [3] })]
    const r = mechResources({} as Sheet, { modifiers: [], bonuses: [] })
    expect(r.overcharge).toBe('2 → 3 → 5 → 9')
    expect(r.structureRepairs).toBe(3)
    expect(turnEntries(null, null).steps.find((s) => s.heat)!.heat).toBe('2 → 3 → 5 → 9')
    expect(stepActions('Overcharge', [])[1].heat!.steps).toEqual(['2', '3', '5', '9'])
  })

  it('shows a homebrew rule row on the page', () => {
    ruleItems.value = [...RULES_SEED, item({ id: 'hb_rule_fog', name: 'Fog', section: 'statuses', group: 'conditions', text: 'You cannot see far.' }), item({ id: 'hb_rule_t', name: 'Quick words', section: 'turn_steps', text: 'x' })]
    expect(statusGroups()[1].rows.map((r) => r.value)).toContain('Fog')
    expect(turnSteps().some((s) => s.name === 'Quick words')).toBe(true)
    ruleItems.value = [...RULES_SEED, item({ id: 'hb_rule_terrain', name: 'Ice', section: 'movement', group: 'terrain', text: 'Slippery ice.' })]
    expect(topicText()).toContain('Slippery ice.')
  })

  it('reads stored data and rejects unreadable rows', () => {
    expect(toRuleItem('a', { name: 'N', section: 'nope' })).toBeNull()
    expect(toRuleItem('a', { name: ' ', section: 'notes' })).toBeNull()
    expect(toRuleItem('a', { name: 'N', section: 'numbers', numbers: [1, 'x'] })!.numbers).toBeUndefined()
    expect(toRuleItem('a', { name: 'N', section: 'notes', hidden: true })).toMatchObject({ text: '', hidden: true })
  })

  it('validates a rule in the editor', () => {
    const check = (data: object) => validateItem('rules', { ...blankItem('rules', 'a'), name: 'N', ...data } as never, { id: 'a' } as never).map((p) => p.field)
    expect(check({})).toEqual([])
    expect(check({ section: 'nope' })).toEqual(['section'])
    expect(check({ section: 'statuses' })).toEqual(['group'])
    expect(check({ numbers: [1] })).toEqual(['numbers'])
    expect(check({ section: 'numbers' })).toEqual(['numbers'])
    expect(check({ section: 'numbers', numbers: [1, NaN] })).toEqual(['numbers'])
    expect(check({ section: 'numbers', numbers: [1, 2] })).toEqual([])
    expect(check({ order: 'x' })).toEqual(['order'])
  })

  it('checks track numbers are whole numbers inside their range, with one message each', () => {
    const msgs = (id: string, numbers: unknown) => validateItem('rules', { ...blankItem('rules', id), name: 'N', section: 'numbers', numbers } as never, { id } as never).map((p) => p.text)
    const heat = 'rule_numbers_overcharge_heat', repair = 'rule_numbers_repair_cost'
    expect(msgs(heat, [1, 3, 5, 9])).toEqual([])
    expect(msgs(heat, [])).toEqual(['Add at least one number.'])
    for (const bad of [[Number.NaN], ['x'], [null], [1, '']]) expect(msgs(heat, bad)).toEqual(['Every number needs a value.'])
    for (const bad of [[-3], [1.5], [99999999], [1, 100]]) expect(msgs(heat, bad)).toEqual(['Numbers must be whole numbers from 0 to 99.'])
    expect(msgs(heat, [1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual(['Overcharge heat can have at most 8 numbers.'])
    expect(msgs(repair, [20])).toEqual([])
    expect(msgs(repair, [21])).toEqual(['Numbers must be whole numbers from 0 to 20.'])
    expect(msgs(repair, [-1])).toEqual(['Numbers must be whole numbers from 0 to 20.'])
    expect(msgs(repair, [1, 2])).toEqual(['Repair cost must be a single number.'])
    expect(msgs('rule_num_starting_manna', [-3])).toEqual(['Starting manna must be a whole number from 0 to 100000.'])
    expect(msgs('rule_num_starting_manna', [1.5])).toEqual(['Starting manna must be a whole number from 0 to 100000.'])
  })
})
