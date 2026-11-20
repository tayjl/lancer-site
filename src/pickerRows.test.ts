import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { toItem } from './gameData'
import type { Manufacturer } from './info'
import { toFrame } from './mechData'
import { bonusStats, framePick, frameRanges, groupPicks, itemPick, keyTags, makerGroup, type PickOption } from './pickerRows'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const makers: Manufacturer[] = [
  { id: 'GMS', name: 'General Massive Systems', quote: '', description: '' },
  { id: 'IPS-N', name: 'Interplanetary Shipping - Northstar', quote: '', description: '' },
]
const rows = (kind: string) => coreContent.items.filter((item) => item.kind === kind)
const frames = rows('frames').map(({ id, data }) => toFrame(id, data))
const option = (id: string, group: string, blocked = ''): PickOption => ({ id, name: id, blocked, group: makerGroup(group, makers) })

describe('pickerRows', () => {
  it('makes a box per manufacturer: known ones in order, unknown after, other last', () => {
    expect(makerGroup('IPS-N', makers)).toMatchObject({ key: 'IPS-N', title: 'IPS-N', name: 'Interplanetary Shipping - Northstar', order: 1 })
    expect(makerGroup('ZZZ', makers).order).toBe(2)
    expect(makerGroup('', makers)).toMatchObject({ key: 'other', title: 'Other', order: 3 })
  })

  it('puts choosable options first in a box and boxes with nothing choosable last', () => {
    const boxes = groupPicks([option('a', 'GMS', 'no'), option('b', 'IPS-N', 'GM only'), option('c', 'GMS'), option('d', 'IPS-N', 'GM only')])
    expect(boxes.map((box) => box.group?.key)).toEqual(['GMS', 'IPS-N'])
    expect(boxes[0].options.map((o) => o.id)).toEqual(['c', 'a'])
    // The current option counts as choosable, even though its own reason says otherwise.
    expect(groupPicks([option('x', 'GMS', 'GM only'), option('y', 'IPS-N')], 'x').map((box) => box.group?.key)).toEqual(['GMS', 'IPS-N'])
    // A fixed box keeps its order with nothing choosable in it.
    const kind = (id: string, order: number, blocked = ''): PickOption => ({ id, name: id, blocked, group: { key: id, title: id, colour: 'var(--rule)', logo: null, order, fixed: true } })
    expect(groupPicks([kind('Gear', 2), kind('Armor', 0, 'Not enough manna')]).map((box) => box.group?.key)).toEqual(['Armor', 'Gear'])
    // Options with no manufacturer come first.
    expect(groupPicks([option('a', 'GMS'), { id: 'g', name: 'g' }]).map((box) => box.group?.key)).toEqual([undefined, 'GMS'])
  })

  it('lists the Exotic box after every other box, and Exotic items last in their box', () => {
    expect(makerGroup('exotic', makers)).toMatchObject({ key: 'EXOTIC', title: 'Exotic', name: undefined, colour: 'var(--rule)', logo: null, order: 4 })
    const live = groupPicks([option('e', 'EXOTIC'), option('o', ''), option('g', 'GMS'), option('z', 'ZZZ')])
    expect(live.map((box) => box.group?.key)).toEqual(['GMS', 'ZZZ', 'other', 'EXOTIC'])
    // Blocked boxes sink below the live ones, but Exotic is still after them.
    const sunk = groupPicks([option('e', 'EXOTIC', 'GM edit only'), option('h', 'IPS-N', 'GM only'), option('g', 'GMS')])
    expect(sunk.map((box) => box.group?.key)).toEqual(['GMS', 'IPS-N', 'EXOTIC'])
    // A tagged prototype from a real manufacturer goes last in its own box, even past a blocked item.
    const box = groupPicks([{ ...option('proto', 'GMS'), exotic: true }, option('plain', 'GMS', 'no'), option('free', 'GMS')])[0]
    expect(box.options.map((o) => o.id)).toEqual(['free', 'plain', 'proto'])
  })

  it('shows a weapon as mount, range, damage, SP and key tags, never its rules', () => {
    const weapon = rows('weapons').map(({ id, data }) => toItem(id, data)).find((item) => item.mount === 'Main' && item.damage.length && item.tags.some((tag) => tag.id === 'tg_unique' || tag.id === 'tg_loading'))!
    const pick = itemPick(weapon, new Map(), makers)
    expect(pick.stats?.some((stat) => stat.kind === 'damage')).toBe(true)
    expect(pick.chips?.some((chip) => chip.label.startsWith('Main'))).toBe(true)
    expect(pick.chips!.length).toBeLessThanOrEqual(5)
    expect(pick.text).toBeUndefined()
    expect(pick.group?.key).toBe(String(weapon.raw?.source))
  })

  it('keeps tag chips to the limit, most important first', () => {
    const item = toItem('x', { name: 'X', tags: [{ id: 'tg_smart' }, { id: 'tg_unique' }, { id: 'tg_limited', val: 3 }, { id: 'tg_ap' }] })
    expect(keyTags(item, new Map(), 3).map((chip) => chip.label)).toEqual(['unique', 'limited 3', 'ap'])
  })

  it('gives a frame its key stats, its roles and mounts, and a radar between the lowest and highest', () => {
    const ranges = frameRanges(frames)
    const pick = framePick(frames[0], ranges, makers)
    expect(pick.stats?.map((stat) => stat.label)).toContain('HP')
    expect(pick.chips?.length).toBeGreaterThan(0)
    expect(pick.radar?.every((axis) => axis.at >= 0 && axis.at <= 1)).toBe(true)
  })

  it('shows only permanent numbers a core bonus adds', () => {
    expect(bonusStats([{ id: 'hp', val: 5 }, { id: 'speed', val: 1, condition: 'when moving' }, { id: 'edef', val: 2, replace: true }, { id: 'armor', val: -1 }]).map((stat) => stat.value)).toEqual(['+5', '-1'])
  })
})
