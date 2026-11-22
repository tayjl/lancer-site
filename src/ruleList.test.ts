import { describe, expect, it } from 'vitest'
import { problemsFor } from './contentEditor'
import type { ListRow } from './editorStore'
import { RULE_CATEGORIES, canAdd, newKind, newRule, oldLink, ruleBoxes, ruleCounts, tabOf } from './ruleList'
import { SECTIONS } from './rulesData'

const row = (key: string, o: Partial<ListRow> = {}): ListRow => ({ key, kind: 'rules', name: key, facts: '', packId: 1, draft: false, edited: false, section: 'attacks', group: 'formula', order: 10, ...o })
const none = { query: '', expanded: new Set<string>() }

describe('Rules tab categories', () => {
  it('lists every section once, plus actions and tags, in the combat page order', () => {
    const keys = RULE_CATEGORIES.map((c) => c.key)
    expect(keys).toHaveLength(SECTIONS.length + 2)
    expect(new Set(keys)).toEqual(new Set([...SECTIONS.map((s) => s.id), 'actions', 'tags']))
    expect(keys.slice(0, 6)).toEqual(['turn_steps', 'actions', 'tags', 'tag_list', 'sizes', 'statuses'])
    expect(keys.slice(-2)).toEqual(['notes', 'numbers'])
    expect(RULE_CATEGORIES.find((c) => c.key === 'tag_list')?.label).toBe('Tags card')
  })
  it('gives no New button to the fixed sections', () => {
    expect(['notes', 'turn_steps', 'numbers'].some(canAdd)).toBe(false)
    expect(['statuses', 'actions', 'tags', 'tag_list'].every(canAdd)).toBe(true)
  })
})

describe('old links', () => {
  it('sends ?cat=tags and ?cat=actions to Rules', () => {
    expect(oldLink({ cat: 'tags', item: 'tg_ap' })).toEqual({ cat: 'rules', sec: 'tags' })
    expect(oldLink({ cat: 'actions' })).toEqual({ cat: 'rules', sec: 'actions' })
    expect(oldLink({ cat: 'weapons' })).toBeNull()
    expect(tabOf('tags')).toBe('rules')
    expect(tabOf('frames')).toBe('frames')
  })
})

describe('the Rules list', () => {
  const rows = [
    row('b', { name: 'B', order: 20 }), row('a', { name: 'A', order: 20 }), row('c', { name: 'C', order: 5, group: 'result' }),
    row('lost', { section: 'nope' }), row('act', { kind: 'actions', section: undefined, name: 'Skirmish' }), row('tg', { kind: 'tags', section: undefined, name: 'Accurate' }),
    row('n', { section: 'notes', group: '', name: 'Stun note' }),
  ]
  it('boxes by category with sub-labels, sorted by group, order then name', () => {
    const boxes = ruleBoxes(rows, none)
    expect(boxes.map((b) => b.key)).toEqual([...RULE_CATEGORIES.map((c) => c.key), 'other'])
    expect(boxes.filter((b) => b.total).map((b) => b.key)).toEqual(['actions', 'tags', 'attacks', 'notes', 'other'])
    const attacks = boxes.find((b) => b.key === 'attacks')!
    expect(attacks.parts.map((p) => p.label)).toEqual(['Attack formulas', 'Attack results'])
    expect(attacks.parts[0].rows.map((r) => r.key)).toEqual(['a', 'b'])
    expect(boxes.find((b) => b.key === 'other')!.parts[0].rows.map((r) => r.key)).toEqual(['lost'])
  })
  it('narrows to one category, and a search hides boxes with no match', () => {
    expect(ruleBoxes(rows, { ...none, sec: 'statuses' }).map((b) => [b.key, b.total])).toEqual([['statuses', 0]])
    expect(ruleBoxes(rows, { ...none, query: 'stun' }).map((b) => b.key)).toEqual(['notes'])
  })
  it('limits a long box until it is expanded', () => {
    const many = Array.from({ length: 50 }, (_, i) => row(`t${i}`, { kind: 'tags', section: undefined, name: `T${String(i).padStart(2, '0')}` }))
    const box = ruleBoxes(many, { ...none, sec: 'tags' })[0]
    expect([box.parts[0].rows.length, box.more]).toEqual([40, 10])
    expect(ruleBoxes(many, { sec: 'tags', query: '', expanded: new Set(['tags']) })[0].more).toBe(0)
  })
  it('counts each category', () => {
    expect(ruleCounts(rows)).toMatchObject({ attacks: 3, actions: 1, tags: 1, notes: 1, other: 1 })
  })
})

describe('new rules', () => {
  it('start in their section, last order plus 10', () => {
    expect(newRule('hb_rule_x', 'sizes', [])).toMatchObject({ section: 'sizes', order: 10 })
    expect(newRule('hb_rule_x', 'attacks', [row('a', { order: 40 }), row('b', { section: 'checks', order: 90 })])).toMatchObject({ section: 'attacks', order: 50 })
  })
  it('ask for a group where the section has groups, and are blocked until one is chosen', () => {
    const fresh = { ...newRule('hb_rule_x', 'statuses', []), name: 'Stunned' }
    expect((fresh as { group?: string }).group).toBe('')
    expect(problemsFor('rules', fresh, { id: 'hb_rule_x' } as never).map((p) => p.field)).toEqual(['group'])
    expect('group' in newRule('hb_rule_x', 'sizes', [])).toBe(false)
  })
  it('make an action or a tag when started from those boxes', () => {
    expect([newKind('actions'), newKind('tags'), newKind('statuses'), newKind(undefined)]).toEqual(['actions', 'tags', 'rules', 'rules'])
  })
})
