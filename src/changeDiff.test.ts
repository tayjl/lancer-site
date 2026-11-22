import { describe, expect, it } from 'vitest'
import { changeDiff, listDiff, reviewSections, writingSummary, type Names } from './changeDiff'
import { wordCount } from './richTextSafe'
import type { MechPrivate, Sheet } from './myPilot'
import { mannaSpent } from './rules'
import { ruleItems, RULES_SEED } from './rulesData'

const names: Names = {
  stat: (id) => id,
  licence: (id) => `L:${id}`,
  talent: (id) => `T:${id}`,
  coreBonus: (id) => `CB:${id}`,
  bionic: (id) => `B:${id}`,
  gear: (id) => `G:${id}`,
  frame: (id) => `F:${id}`,
  weapon: (id) => `W:${id}`,
  system: (id) => `S:${id}`,
  mod: (id) => `M:${id}`,
}

describe('edited prices', () => {
  it('change the manna a licence rank costs in the diff', () => {
    const diff = () => changeDiff({ card: {}, sheet: {} }, { card: {}, sheet: { licences: { frame: 1 } } }, names)[0] as { manna?: number }
    expect(diff().manna).toBe(600)
    ruleItems.value = [{ id: 'rule_num_licence_rank_price', name: 'x', section: 'numbers', text: '', order: 1, numbers: [750] }]
    expect(diff().manna).toBe(750)
    ruleItems.value = RULES_SEED
  })
})

describe('listDiff', () => {
  it('counts repeats', () => {
    expect(listDiff(['drone', 'drone', 'knife'], ['drone', 'rifle'])).toEqual({ added: ['rifle'], removed: ['drone', 'knife'] })
  })
})

describe('changeDiff', () => {
  it('uses separate character-sheet categories in sheet order', () => {
    const doc = { type: 'doc', content: [] }
    const lines = changeDiff(
      { card: {}, sheet: {} },
      { card: { appearance: doc, personality: doc }, sheet: {
        backstory: doc, pilot_stats: { physicality: 3 }, mech_skills: { hull: 1 },
        bionics: [1], owned_gear: [{ key: 'a', id: 'knife' }], licences: { frame: 1 }, core_bonuses: ['bonus'], talents: { ace: 1 },
      } },
      names,
    )
    expect([...new Set(lines.map(line => line.section))]).toEqual([
      'appearance', 'personality', 'backstory', 'personal stats', 'piloting stats',
      'biomods', 'loadout', 'licences', 'core bonuses', 'talents',
    ])
  })

  it('says nothing when nothing changed', () => {
    const side = { card: { callsign: 'Deuce', mechs: [] }, sheet: { mech_skills: { hull: 1 } } }
    expect(changeDiff(side, side, names)).toEqual([])
  })

  it('lists identity, stats, purchases and mech changes in plain words', () => {
    const mech = { id: 'm1', name: 'Lantern', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const before = {
      card: { callsign: 'Deuce', age: null, mechs: [mech] },
      sheet: {
        mech_skills: { hull: 1 },
        licences: { blackbeard: 2 },
        bionics: [1],
        owned_gear: [{ key: 'a', id: 'drone' }],
        mechs: { m1: { frame: 'everest', mounts: [['rifle']], systems: ['paint'] } },
      },
    }
    const after = {
      card: { callsign: 'Deuce Prime', age: '31', mechs: [{ ...mech, name: 'Lantern II' }] },
      sheet: {
        mech_skills: { hull: 2, agility: 1 },
        licences: { blackbeard: 3, drake: 1 },
        talents: { t_ace: 1 },
        bionics: [1, 2],
        owned_gear: [{ key: 'a', id: 'drone' }, { key: 'b', id: 'drone' }],
        mechs: { m1: { frame: 'blackbeard', mounts: [['axe']], systems: ['paint'] } },
      },
    }
    expect(changeDiff(before, after, names).map((line) => `${line.section} | ${line.kind} | ${line.text}`)).toEqual([
      'identity | updated | Callsign: Deuce → Deuce Prime',
      'identity | added | Age: - → 31',
      'piloting stats | raised | Hull 1 → 2',
      'piloting stats | raised | Agility 0 → 1',
      'biomods | added | B:2',
      'loadout | added | Bought G:drone',
      'mech: Lantern II / identity | updated | Name: Lantern → Lantern II',
      'mech: Lantern II / frame | updated | Frame: F:everest → F:blackbeard',
      'mech: Lantern II / weapon mounts | added | W:axe',
      'mech: Lantern II / weapon mounts | removed | W:rifle',
      'licences | raised | L:blackbeard licence, rank II → III',
      'licences | added | L:drake licence, rank I',
      'talents | added | T:t_ace, rank I',
    ])
  })

  it('gives each line one of five kinds: added, raised, removed, lowered or updated', () => {
    const lines = changeDiff(
      { card: { callsign: 'Old', age: '30' }, sheet: { pilot_stats: { acuity: 3 }, licences: { frame: 1, other: 2 }, talents: { old: 1 }, owned_gear: [{ key: 'a', id: 'knife' }] } },
      { card: { callsign: 'New', age: null }, sheet: { pilot_stats: { acuity: 2 }, licences: { frame: 2, other: 1 }, talents: { fresh: 1 }, owned_gear: [] } },
      names,
    )
    expect(lines.map((line) => `${line.kind} | ${line.text}`)).toEqual([
      'updated | Callsign: Old → New',
      'removed | Age: 30 → -',
      'lowered | Acuity 3 → 2',
      'raised | L:frame licence, rank I → II',
      'lowered | L:other licence, rank II → I',
      'removed | T:old, rank I',
      'added | T:fresh, rank I',
    ])
  })

  it('says which weapon a mod is on, whether it is added, removed or swapped', () => {
    const mech = { id: 'm1', name: 'Lantern', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const side = (mounts: (string | null)[][], weapon_mods: Record<string, string>) => ({ card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts, weapon_mods } } } })
    const text = (before: ReturnType<typeof side>, after: ReturnType<typeof side>) => changeDiff(before, after, names).map((line) => `${line.kind} | ${line.text}`)
    const rifle = [['rifle'], ['cannon']]
    expect(text(side(rifle, {}), side(rifle, { '0:0': 'wm_a' }))).toEqual(['added | Mod on W:rifle: M:wm_a'])
    expect(text(side(rifle, { '1:0': 'wm_a' }), side(rifle, {}))).toEqual(['removed | Mod on W:cannon: M:wm_a'])
    expect(text(side(rifle, { '0:0': 'wm_a' }), side(rifle, { '0:0': 'wm_b' }))).toEqual(['updated | Mod on W:rifle: M:wm_a → M:wm_b'])
    // The mod leaves with its weapon: it is named for the weapon it was on.
    expect(text(side(rifle, { '0:0': 'wm_a' }), side([['pistol'], ['cannon']], {}))).toEqual([
      'added | W:pistol', 'removed | W:rifle', 'removed | Mod on W:rifle: M:wm_a',
    ])
  })

  it('includes new writing without repeating unchanged writing', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New backstory.' }] }] }
    const lines = changeDiff(
      { card: { personality: doc }, sheet: {} },
      { card: { personality: doc }, sheet: { backstory: doc } },
      names,
    )
    expect(lines).toEqual([{ section: 'backstory', text: 'Backstory', kind: 'added', doc }])
  })

  it('flags mount rearrangements even when no weapons were bought or removed', () => {
    const mech = { id: 'm1', name: 'Mech', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const lines = changeDiff(
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle'], ['knife']] } } } },
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['knife'], ['rifle']] } } } },
      names,
    )
    expect(lines).toEqual([{ section: 'mech: Mech / weapon mounts', text: 'Weapon mounts rearranged', kind: 'updated', mechId: 'm1' }])
  })

  it('shows core target and per-weapon configuration changes in readable terms', () => {
    const mech = { id: 'm1', name: 'Mech', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const lines = changeDiff(
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle']] } } } },
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle']], core_mounts: { cb_overpower_caliber: 0 }, weapon_options: { '0:0': { profile: 1, type: 'Melee' } } } } } }, names,
    )
    expect(lines.map(line => line.text)).toEqual([
      'CB:cb_overpower_caliber target: Unassigned → Mount 1, W:rifle',
      'Mount 1, weapon 1 configuration: Defaults → Profile 2, Melee',
    ])
  })

  it('describes item descriptions and a chosen damage type, by the item they are on', () => {
    const card = { mechs: [{ id: 'm1', name: 'Mech', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }] }
    const text = (before: Sheet, after: Sheet) => changeDiff({ card, sheet: before }, { card, sheet: after }, names).map((line) => `${line.section} | ${line.kind} | ${line.text}`)
    const onMech = (m1: MechPrivate): Sheet => ({ mechs: { m1 } })
    // Pilot gear, by owned key: a description added, and one kept with its copy when another copy of the item is also owned.
    const own = (...items: [string, string, string?][]): Sheet => ({ owned_gear: items.map(([key, id, notes]) => ({ key, id, notes })) })
    expect(text(own(['a', 'knife'], ['b', 'rifle']), own(['a', 'knife'], ['b', 'rifle', 'salvaged railgun'])))
      .toEqual(['loadout | added | G:rifle description: - → salvaged railgun'])
    expect(text(own(['a', 'rifle', 'x'], ['b', 'rifle', 'y']), own(['a', 'rifle', 'x'], ['b', 'rifle', 'z'])))
      .toEqual(['loadout | updated | G:rifle description: y → z'])
    const typed = (damageType?: string): Sheet => ({ owned_gear: [{ key: 'a', id: 'rifle', damageType }] })
    expect(text(typed(), typed('Energy'))).toEqual(['loadout | added | G:rifle damage type: - → Energy'])
    // Bought items are the new keys, with their price; equipping isn't a change.
    const bought = changeDiff({ card: {}, sheet: { ...own(['a', 'knife']), equipped_gear: [] } }, { card: {}, sheet: { ...own(['a', 'knife'], ['b', 'knife']), equipped_gear: ['a'] } }, names, { bionic: () => 0, gear: () => 250 })
    expect(bought.map(line => `${line.text} | ${line.manna}`)).toEqual(['Bought G:knife | 250'])
    // A mech weapon's description changed, with no configuration line.
    expect(text(onMech({ mounts: [['rifle']], weapon_options: { '0:0': { notes: 'old' } } }), onMech({ mounts: [['rifle']], weapon_options: { '0:0': { notes: 'new' } } })))
      .toEqual(['mech: Mech / weapon mounts | updated | W:rifle description: old → new'])
    // A system's description removed, and a removed system's list closing up.
    expect(text(onMech({ systems: ['paint'], system_notes: { 0: 'red' } }), onMech({ systems: ['paint'] })))
      .toEqual(['mech: Mech / systems | removed | S:paint description: red → -'])
    expect(text(onMech({ systems: ['paint', 'sensor'], system_notes: { 0: 'a', 1: 'b' } }), onMech({ systems: ['sensor'], system_notes: { 0: 'b' } })))
      .toEqual(['mech: Mech / systems | removed | S:paint', 'mech: Mech / systems | removed | S:paint description: a → -'])
    // A Variable weapon's damage type chosen.
    expect(text(onMech({ mounts: [['ghoul']], weapon_options: { '0:0': {} } }), onMech({ mounts: [['ghoul']], weapon_options: { '0:0': { damageType: 'Energy' } } })))
      .toEqual(['mech: Mech / weapon mounts | updated | Mount 1, weapon 1 configuration: Defaults → Energy'])
  })
})

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const mech = (id: string, name: string) => ({ id, name, manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null })

describe('manna on lines', () => {
  it('prices ranks, biomods and extra mechs, and adds up to what the sheet spends', () => {
    const prices = { bionic: (id: number) => (id === 1 ? 500 : 800) }
    const before = { card: { mechs: [mech('a', 'One')] }, sheet: { licences: { x: 1 }, bionics: [1], talents: { t: 2 } } }
    const after = { card: { mechs: [mech('a', 'One'), mech('b', 'Two')] }, sheet: { licences: { x: 3 }, bionics: [2], talents: {} } }
    const lines = changeDiff(before, after, names, prices)
    const byText = Object.fromEntries(lines.map((line) => [line.text, line.manna]))
    expect(byText['L:x licence, rank I → III']).toBe(1200)
    expect(byText['B:2']).toBe(800)
    expect(byText['B:1']).toBe(-500)
    expect(byText['T:t, rank II']).toBe(-600)
    expect(byText['New mech, ID AAAA-AAAA-AAAA']).toBe(500)
    const map = new Map([[1, 500], [2, 800]])
    const spend = (side: { sheet: Parameters<typeof mannaSpent>[0] }, mechs: number) => mannaSpent(side.sheet, map, mechs, [], null)
    expect(lines.reduce((sum, line) => sum + (line.manna ?? 0), 0)).toBe(spend(after, 2) - spend(before, 1))
  })

  it('makes the first mech and the last mech free', () => {
    const first = changeDiff({ card: { mechs: [] }, sheet: {} }, { card: { mechs: [mech('a', 'One'), mech('b', 'Two')] }, sheet: {} }, names)
    expect(first.map((line) => line.manna)).toEqual([undefined, 500])
    const last = changeDiff({ card: { mechs: [mech('a', 'One')] }, sheet: {} }, { card: { mechs: [] }, sheet: {} }, names)
    expect(last).toEqual([{ section: 'mech: One', text: 'Mech scrapped', kind: 'removed', mechId: 'a' }])
  })
})

describe('reviewSections', () => {
  it('puts the sheet sections in sheet order, then mechs, whatever order the lines came in', () => {
    const lines = changeDiff(
      { card: { mechs: [] }, sheet: {} },
      { card: { mechs: [mech('a', 'Lantern')], callsign: 'X' }, sheet: { talents: { t: 1 }, licences: { l: 1 }, mech_skills: { hull: 1 }, pilot_stats: { acuity: 3 }, backstory: doc('Hi') } },
      names,
    )
    expect(reviewSections(lines).map((section) => section.title)).toEqual([
      'Identity', 'Backstory', 'Personal stats', 'Piloting stats', 'Licences', 'Talents', 'Mech: Lantern',
    ])
  })

  it('keeps one panel per mech with sub-groups in order, a new or scrapped state, counts and manna', () => {
    const [m1, m2] = [mech('a', 'Lantern'), mech('b', 'Ghost')]
    const lines = changeDiff(
      { card: { mechs: [m1, m2] }, sheet: { mechs: { a: { frame: 'f1', systems: ['s1'], mounts: [['w1']] } } } },
      { card: { mechs: [{ ...m1, name: 'Lantern II' }, mech('c', 'Fresh')] }, sheet: { mechs: { a: { frame: 'f2', systems: ['s2'], mounts: [['w2']], history: doc('x') } } } },
      names,
    )
    const sections = reviewSections(lines)
    const lantern = sections.find((section) => section.mech === 'Lantern II')!
    expect(lantern.groups.map((group) => group.title)).toEqual(['identity', 'frame', 'history', 'weapon mounts', 'systems'])
    // Within a group: added, then updated, then removed.
    expect(lantern.groups[3].lines.map((line) => line.kind)).toEqual(['added', 'removed'])
    expect(lantern.counts).toEqual({ up: 3, down: 2, info: 2 })
    expect(sections.find((section) => section.mech === 'Fresh')).toMatchObject({ mechState: 'new', manna: 500, groups: [{ title: '' }] })
    expect(sections.find((section) => section.mech === 'Ghost')).toMatchObject({ mechState: 'scrapped', manna: -500 })
  })

  it('orders lines added or raised, then updated, then removed or lowered', () => {
    const lines = changeDiff(
      { card: { callsign: 'A' }, sheet: { bionics: [1], pilot_stats: { acuity: 3 } } },
      { card: { callsign: 'B', age: '9' }, sheet: { bionics: [], pilot_stats: { acuity: 3 } } },
      names,
    )
    expect(reviewSections(lines)[0].groups[0].lines.map((line) => line.kind)).toEqual(['added', 'updated'])
    expect(reviewSections(lines)[1].groups[0].lines.map((line) => line.kind)).toEqual(['removed'])
  })
})

describe('writing', () => {
  it('counts words', () => {
    expect(wordCount(doc('One two  three'))).toBe(3)
    expect(wordCount(null)).toBe(0)
  })

  it('summarises long writing, with before and after when there was something before', () => {
    const [line] = changeDiff({ card: {}, sheet: { backstory: doc('one two three') } }, { card: {}, sheet: { backstory: doc('one two three four five') } }, names)
    expect(line.before).toEqual(doc('one two three'))
    expect(writingSummary(line)).toBe('Backstory rewritten · 3 → 5 words')
    const [fresh] = changeDiff({ card: {}, sheet: {} }, { card: {}, sheet: { backstory: doc('one two') } }, names)
    expect(writingSummary(fresh)).toBe('Backstory written · 2 words')
    expect(writingSummary({ section: 'identity', text: 'Age: - → 3', kind: 'added' })).toBeNull()
  })
})

describe('mechs with the same name', () => {
  it('stay in their own panels, each carrying its id, and a rename keeps the same panel', () => {
    const [a, b] = [mech('a', 'Twin'), mech('b', 'Twin')]
    const lines = changeDiff(
      { card: { mechs: [a, b] }, sheet: { mechs: { a: { frame: 'f1' }, b: { frame: 'f1' } } } },
      { card: { mechs: [{ ...a, name: 'Twin Prime' }, b] }, sheet: { mechs: { a: { frame: 'f2' }, b: { frame: 'f3' } } } },
      names,
    )
    const sections = reviewSections(lines)
    expect(sections.map((section) => [section.mechId, section.title])).toEqual([['a', 'Mech: Twin Prime'], ['b', 'Mech: Twin']])
    expect(sections.every((section) => section.groups.some((group) => group.title === 'frame'))).toBe(true)
  })
})
